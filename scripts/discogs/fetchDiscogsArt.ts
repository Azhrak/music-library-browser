import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ART_CONFIG } from "../albumArtConfig.js";
import { collectArtists } from "../traversal.js";
import type { Album, MusicLibrary } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const DISCOGS_API = "https://api.discogs.com";
const USER_AGENT = "MusicLibraryBrowser/1.0 +https://music-library.azhrak.dev";
const MANIFEST_PATH = "data/generated/discogsArtManifest.json";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiscogsSearchResult {
  id: number;
  title: string;
  year?: string;
  cover_image?: string; // only populated with auth token
  thumb?: string;
}

interface DiscogsSearchResponse {
  results: DiscogsSearchResult[];
}

interface DiscogsImage {
  type: "primary" | "secondary";
  uri: string;
  uri150: string;
}

interface DiscogsRelease {
  id: number;
  title: string;
  images?: DiscogsImage[];
}

interface DiscogsManifestEntry {
  discogsId: number | null; // null = queried but no match / no art
  hasArt: boolean;
  fetchedAt: string;
}

interface DiscogsManifest {
  generatedAt: string;
  totalQueried: number;
  totalWithArt: number;
  entries: Record<string, Record<string, DiscogsManifestEntry>>;
}

interface ArtManifest {
  generatedAt: string;
  musicLibraryRoot: string;
  totalAlbums: number;
  albumsWithArt: number;
  albumsWithoutArt: number;
  entries: Record<
    string,
    Record<string, { artistSlug: string; albumSlug: string; sourceFile: string }>
  >;
}

interface Job {
  artistSlug: string;
  artistName: string;
  album: Album;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Discogs API ──────────────────────────────────────────────────────────────

async function discogsGet<T>(url: string, token: string | null): Promise<{ data: T } | null> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (token) headers.Authorization = `Discogs token=${token}`;

  try {
    const res = await fetch(url, { headers });

    if (res.status === 429) {
      console.warn("  Rate limited by Discogs — waiting 60s...");
      await sleep(60_000);
      return null;
    }
    if (!res.ok) return null;

    const data: T = await res.json();
    return { data };
  } catch (err) {
    console.warn(`  Discogs fetch error: ${err}`);
    return null;
  }
}

async function searchDiscogsWithYear(
  artistName: string,
  albumName: string,
  year: number | null,
  token: string | null,
): Promise<DiscogsSearchResult | null> {
  const params = new URLSearchParams({
    artist: artistName,
    release_title: albumName,
    type: "release",
    per_page: "5",
  });
  const url = `${DISCOGS_API}/database/search?${params}`;
  const result = await discogsGet<DiscogsSearchResponse>(url, token);
  if (!result?.data.results?.length) return null;

  const localNorm = normalize(albumName);

  interface Candidate {
    result: DiscogsSearchResult;
    score: number;
  }
  const candidates: Candidate[] = [];

  for (const r of result.data.results) {
    const releaseName = r.title.includes(" - ")
      ? r.title.split(" - ").slice(1).join(" - ")
      : r.title;
    const relNorm = normalize(releaseName);

    if (relNorm !== localNorm && !relNorm.includes(localNorm) && !localNorm.includes(relNorm))
      continue;

    let score = relNorm === localNorm ? 100 : 60;

    if (year && r.year) {
      const relYear = Number.parseInt(r.year, 10);
      const diff = Math.abs(relYear - year);
      if (diff === 0) score += 20;
      else if (diff === 1) score += 5;
      else if (diff > 3) score -= 30;
    }

    candidates.push({ result: r, score });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].result;
}

async function getReleaseImageUrl(discogsId: number, token: string | null): Promise<string | null> {
  const url = `${DISCOGS_API}/releases/${discogsId}`;
  const result = await discogsGet<DiscogsRelease>(url, token);
  if (!result) return null;

  const primary = result.data.images?.find((img) => img.type === "primary");
  const any = result.data.images?.[0];
  return primary?.uri ?? any?.uri ?? null;
}

async function downloadAndSaveArt(
  imageUrl: string,
  artistSlug: string,
  albumSlug: string,
): Promise<boolean> {
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    const outDir = path.join(ROOT, ART_CONFIG.OUTPUT_DIR, artistSlug);
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, `${albumSlug}.webp`);
    await sharp(buffer)
      .resize(ART_CONFIG.IMAGE_SIZE, ART_CONFIG.IMAGE_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: ART_CONFIG.WEBP_QUALITY })
      .toFile(outPath);

    return true;
  } catch (err) {
    console.warn(`  Download failed for ${artistSlug}/${albumSlug}: ${err}`);
    return false;
  }
}

// ─── Manifest I/O ─────────────────────────────────────────────────────────────

function loadDiscogsManifest(): DiscogsManifest {
  const p = path.join(ROOT, MANIFEST_PATH);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return { generatedAt: "", totalQueried: 0, totalWithArt: 0, entries: {} };
}

function saveDiscogsManifest(manifest: DiscogsManifest): void {
  const p = path.join(ROOT, MANIFEST_PATH);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let total = 0;
  let withArt = 0;
  for (const albums of Object.values(manifest.entries)) {
    for (const entry of Object.values(albums)) {
      total++;
      if (entry.hasArt) withArt++;
    }
  }
  manifest.generatedAt = new Date().toISOString();
  manifest.totalQueried = total;
  manifest.totalWithArt = withArt;
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
}

function loadArtManifest(): ArtManifest {
  const p = path.join(ROOT, ART_CONFIG.MANIFEST_PATH);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return {
    generatedAt: "",
    musicLibraryRoot: "",
    totalAlbums: 0,
    albumsWithArt: 0,
    albumsWithoutArt: 0,
    entries: {},
  };
}

function saveArtManifest(manifest: ArtManifest): void {
  let total = 0;
  for (const albums of Object.values(manifest.entries)) total += Object.keys(albums).length;
  manifest.generatedAt = new Date().toISOString();
  manifest.albumsWithArt = total;
  fs.writeFileSync(path.join(ROOT, ART_CONFIG.MANIFEST_PATH), JSON.stringify(manifest, null, 2));
}

function loadEnvToken(): string | null {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return null;
  const match = fs.readFileSync(envPath, "utf-8").match(/^DISCOGS_TOKEN=(.+)$/m);
  return match?.[1]?.trim() || null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const limit = Number.parseInt(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0",
    10,
  );

  const musicDataPath = path.join(ROOT, "data", "generated", "musicData.json");
  if (!fs.existsSync(musicDataPath)) {
    console.error("musicData.json not found. Run 'pnpm parse' first.");
    process.exit(1);
  }
  const musicData: MusicLibrary = JSON.parse(fs.readFileSync(musicDataPath, "utf-8"));

  const token = loadEnvToken();
  if (token) {
    console.log("Discogs token found — using authenticated requests (60 req/min).");
  } else {
    console.log("No DISCOGS_TOKEN in .env — using unauthenticated requests (25 req/min, slower).");
    console.log("Get a free token at: https://www.discogs.com/settings/developers\n");
  }

  // With token: cover_image may be in search result (1 call/album).
  // Without token: need separate release fetch for image URL (2 calls/album).
  // Delay: leave headroom above the minimum to avoid 429s.
  const delayMs = token ? 1200 : 3000;

  const artManifest = loadArtManifest();
  const discogsManifest = loadDiscogsManifest();

  if (discogsManifest.totalQueried > 0) {
    console.log(
      `Loaded existing Discogs manifest (${discogsManifest.totalQueried} albums queried).`,
    );
  }

  // Only process albums that: have no art AND haven't been tried via Discogs yet
  const jobs: Job[] = [];
  collectArtists(musicData, (artist) => {
    for (const album of artist.albums) {
      const hasArt = !!artManifest.entries[artist.slug]?.[album.slug];
      const alreadyTried = !!discogsManifest.entries[artist.slug]?.[album.slug];
      if (!hasArt && !alreadyTried) {
        jobs.push({ artistSlug: artist.slug, artistName: artist.name, album });
      }
    }
    return null;
  });

  const limited = limit > 0 ? jobs.slice(0, limit) : jobs;
  console.log(`Albums missing art: ${jobs.length}`);
  if (limit > 0) console.log(`Limiting to ${limit} (--limit flag).`);
  console.log(`To query: ${limited.length}\n`);

  if (limited.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let found = 0;
  let notFound = 0;
  let processed = 0;

  for (const job of limited) {
    const { artistSlug, artistName, album } = job;

    // 1. Search Discogs
    const searchResult = await searchDiscogsWithYear(artistName, album.name, album.year, token);
    await sleep(delayMs);

    if (!searchResult) {
      discogsManifest.entries[artistSlug] ??= {};
      discogsManifest.entries[artistSlug][album.slug] = {
        discogsId: null,
        hasArt: false,
        fetchedAt: new Date().toISOString(),
      };
      notFound++;
      processed++;
      if (processed % 100 === 0)
        checkpoint(discogsManifest, artManifest, processed, limited.length, found, notFound);
      continue;
    }

    // 2. Get image URL — from cover_image (authenticated search) or release endpoint
    let imageUrl: string | null = null;
    const coverImage = searchResult.cover_image;
    if (coverImage && !coverImage.includes("spacer.gif") && coverImage.startsWith("http")) {
      imageUrl = coverImage;
    } else {
      // Need a second API call to get the image from the release endpoint
      imageUrl = await getReleaseImageUrl(searchResult.id, token);
      await sleep(delayMs);
    }

    if (!imageUrl) {
      discogsManifest.entries[artistSlug] ??= {};
      discogsManifest.entries[artistSlug][album.slug] = {
        discogsId: searchResult.id,
        hasArt: false,
        fetchedAt: new Date().toISOString(),
      };
      notFound++;
      processed++;
      if (processed % 100 === 0)
        checkpoint(discogsManifest, artManifest, processed, limited.length, found, notFound);
      continue;
    }

    // 3. Download and save
    const ok = await downloadAndSaveArt(imageUrl, artistSlug, album.slug);

    discogsManifest.entries[artistSlug] ??= {};
    discogsManifest.entries[artistSlug][album.slug] = {
      discogsId: searchResult.id,
      hasArt: ok,
      fetchedAt: new Date().toISOString(),
    };

    if (ok) {
      found++;
      artManifest.entries[artistSlug] ??= {};
      artManifest.entries[artistSlug][album.slug] = {
        artistSlug,
        albumSlug: album.slug,
        sourceFile: "discogs",
      };
      console.log(`  ✓ ${artistName} - ${album.name}`);
    } else {
      notFound++;
    }

    processed++;
    if (processed % 100 === 0)
      checkpoint(discogsManifest, artManifest, processed, limited.length, found, notFound);
  }

  saveDiscogsManifest(discogsManifest);
  saveArtManifest(artManifest);

  console.log("\nDone!");
  console.log(`Processed: ${processed}`);
  console.log(`Art found and saved: ${found}`);
  console.log(`Not found / no art: ${notFound}`);
}

function checkpoint(
  discogsManifest: DiscogsManifest,
  artManifest: ArtManifest,
  processed: number,
  total: number,
  found: number,
  notFound: number,
): void {
  saveDiscogsManifest(discogsManifest);
  saveArtManifest(artManifest);
  console.log(`  [checkpoint] ${processed}/${total} — ${found} found, ${notFound} not found`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

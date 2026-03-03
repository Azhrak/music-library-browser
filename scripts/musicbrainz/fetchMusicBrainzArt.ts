import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ART_CONFIG } from "../albumArtConfig.js";
import { collectArtists } from "../traversal.js";
import type { Album, MusicLibrary } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const MB_API = "https://musicbrainz.org/ws/2";
const USER_AGENT = "music-library-browser/1.0 ( https://music-library.azhrak.dev )";
// MusicBrainz allows ~1 req/sec without account; be conservative
const MB_DELAY_MS = 1100;
const MANIFEST_PATH = "data/generated/musicbrainzArtManifest.json";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MBRelease {
  id: string;
  title: string;
  date?: string;
  score: number;
  "artist-credit"?: Array<{ artist: { name: string } }>;
}

interface MBSearchResponse {
  releases: MBRelease[];
}

interface MBManifestEntry {
  mbid: string | null; // null = queried but no match / no art
  hasArt: boolean;
  fetchedAt: string;
}

interface MBManifest {
  generatedAt: string;
  totalQueried: number;
  totalWithArt: number;
  entries: Record<string, Record<string, MBManifestEntry>>;
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

function escapeLucene(s: string): string {
  // Escape special Lucene chars, then wrap in quotes for phrase search
  return `"${s.replace(/["\\]/g, "\\$&")}"`;
}

// ─── MusicBrainz Search ───────────────────────────────────────────────────────

async function searchMusicBrainz(
  artistName: string,
  albumName: string,
  year: number | null,
): Promise<MBRelease | null> {
  const query = `release:${escapeLucene(albumName)} AND artist:${escapeLucene(artistName)}`;
  const url = `${MB_API}/release?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.warn(`  MB search failed (${res.status}): ${artistName} - ${albumName}`);
      return null;
    }

    const data: MBSearchResponse = await res.json();
    if (!data.releases?.length) return null;

    const localNorm = normalize(albumName);

    // Score candidates
    interface Candidate {
      release: MBRelease;
      score: number;
    }
    const candidates: Candidate[] = [];

    for (const release of data.releases) {
      // MB provides its own relevance score (0–100); require a minimum
      if (release.score < 70) continue;

      const relNorm = normalize(release.title);
      if (relNorm !== localNorm && !relNorm.includes(localNorm) && !localNorm.includes(relNorm)) {
        continue;
      }

      let score = release.score;

      // Year match bonus/penalty
      if (year && release.date) {
        const relYear = Number.parseInt(release.date.slice(0, 4), 10);
        const diff = Math.abs(relYear - year);
        if (diff === 0) score += 20;
        else if (diff === 1) score += 5;
        else if (diff > 3) score -= 30;
      }

      candidates.push({ release, score });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].release;
  } catch (err) {
    console.warn(`  MB search error for "${artistName} - ${albumName}": ${err}`);
    return null;
  }
}

// ─── Cover Art Archive ────────────────────────────────────────────────────────

// coverartarchive.org resets connections with Node's fetch (undici HTTP/2 issue).
// Use Node's https module for a HEAD request to get the Location redirect URL,
// then download the actual image from archive.org (which fetch handles fine).
function getCAARedirectUrl(mbid: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "coverartarchive.org",
        path: `/release/${mbid}/front-500`,
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
      },
      (res) => {
        resolve(res.headers.location ?? null);
        res.resume();
      },
    );
    req.on("error", () => resolve(null));
    req.setTimeout(10_000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function fetchCoverArtUrl(mbid: string): Promise<string | null> {
  return getCAARedirectUrl(mbid);
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

function loadMBManifest(): MBManifest {
  const p = path.join(ROOT, MANIFEST_PATH);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return { generatedAt: "", totalQueried: 0, totalWithArt: 0, entries: {} };
}

function saveMBManifest(manifest: MBManifest): void {
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

  const artManifest = loadArtManifest();
  const mbManifest = loadMBManifest();

  if (Object.keys(mbManifest.entries).length > 0) {
    console.log(
      `Loaded existing MusicBrainz manifest (${mbManifest.totalQueried} albums queried).`,
    );
  }

  // Collect albums missing art that haven't been tried via MusicBrainz yet
  const jobs: Job[] = [];
  collectArtists(musicData, (artist) => {
    for (const album of artist.albums) {
      const hasArt = !!artManifest.entries[artist.slug]?.[album.slug];
      const alreadyTried = !!mbManifest.entries[artist.slug]?.[album.slug];
      if (!hasArt && !alreadyTried) {
        jobs.push({ artistSlug: artist.slug, artistName: artist.name, album });
      }
    }
    return null; // collectArtists signature requires a return
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

    // Search MusicBrainz
    const release = await searchMusicBrainz(artistName, album.name, album.year);
    await sleep(MB_DELAY_MS); // always delay after each MB query

    let entry: MBManifestEntry;

    if (!release) {
      entry = { mbid: null, hasArt: false, fetchedAt: new Date().toISOString() };
      notFound++;
    } else {
      // Try to fetch cover art from Cover Art Archive
      const imageUrl = await fetchCoverArtUrl(release.id);

      if (!imageUrl) {
        entry = { mbid: release.id, hasArt: false, fetchedAt: new Date().toISOString() };
        notFound++;
      } else {
        const ok = await downloadAndSaveArt(imageUrl, artistSlug, album.slug);
        entry = { mbid: release.id, hasArt: ok, fetchedAt: new Date().toISOString() };

        if (ok) {
          found++;
          // Update art manifest
          if (!artManifest.entries[artistSlug]) artManifest.entries[artistSlug] = {};
          artManifest.entries[artistSlug][album.slug] = {
            artistSlug,
            albumSlug: album.slug,
            sourceFile: "musicbrainz",
          };
          console.log(`  ✓ ${artistName} - ${album.name}`);
        } else {
          notFound++;
        }
      }
    }

    // Record in MB manifest so we never retry this album
    if (!mbManifest.entries[artistSlug]) mbManifest.entries[artistSlug] = {};
    mbManifest.entries[artistSlug][album.slug] = entry;

    processed++;

    // Checkpoint every 100 albums
    if (processed % 100 === 0) {
      saveMBManifest(mbManifest);
      saveArtManifest(artManifest);
      console.log(
        `  [checkpoint] ${processed}/${limited.length} processed — ${found} art found, ${notFound} not found`,
      );
    }
  }

  // Final save
  saveMBManifest(mbManifest);
  saveArtManifest(artManifest);

  console.log("\nDone!");
  console.log(`Processed: ${processed}`);
  console.log(`Art found and saved: ${found}`);
  console.log(`Not found / no art: ${notFound}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

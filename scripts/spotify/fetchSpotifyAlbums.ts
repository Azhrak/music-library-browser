import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ART_CONFIG } from "../albumArtConfig.js";
import { collectArtists } from "../traversal.js";
import type { Album, MusicLibrary } from "../types.js";
import { authenticate, sleep, spotifyGet } from "./spotifyAuth.js";
import { SPOTIFY_CONFIG } from "./spotifyConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

// ─── Types ──────────────────────────────────────────────────────────────

interface SpotifyArtistEntry {
  artistSlug: string;
  spotifyUrl: string;
  spotifyId: string;
  fetchedAt: string;
}

interface SpotifyArtistManifest {
  entries: Record<string, SpotifyArtistEntry>;
}

interface SpotifyTrack {
  name: string;
  trackNumber: number;
  discNumber: number;
  durationMs: number;
  spotifyUrl: string;
}

interface SpotifyAlbumEntry {
  albumSlug: string;
  artistSlug: string;
  spotifyAlbumId: string;
  spotifyAlbumUrl: string;
  name: string;
  releaseDate: string;
  totalTracks: number;
  imageUrl: string | null;
  tracks: SpotifyTrack[];
  fetchedAt: string;
}

interface SpotifyAlbumManifest {
  generatedAt: string;
  totalArtistsQueried: number;
  totalAlbumsMatched: number;
  totalAlbumsUnmatched: number;
  entries: Record<string, Record<string, SpotifyAlbumEntry>>;
}

interface ArtistJob {
  slug: string;
  name: string;
  spotifyId: string;
  albums: Album[];
}

// Spotify API response types
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyAlbumSimple {
  id: string;
  name: string;
  release_date: string;
  total_tracks: number;
  album_type: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
}

interface SpotifyTrackItem {
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SpotifyAlbumFull extends SpotifyAlbumSimple {
  tracks: {
    items: SpotifyTrackItem[];
    next: string | null;
  };
}

interface AlbumArtEntry {
  artistSlug: string;
  albumSlug: string;
  sourceFile: string;
}

interface ArtManifest {
  generatedAt: string;
  musicLibraryRoot: string;
  totalAlbums: number;
  albumsWithArt: number;
  albumsWithoutArt: number;
  entries: Record<string, Record<string, AlbumArtEntry>>;
}

// ─── Album Matching ─────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ") // Remove parentheticals
    .replace(/\s*\[[^\]]*\]\s*/g, " ") // Remove bracketed text
    .replace(
      /\s*[-–—:]\s*(lossless|remaster(ed)?|deluxe|limited|expanded|edition|bonus\s*tracks?|anniversary|version)\b.*/gi,
      "",
    )
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchSpotifyAlbum(
  localAlbum: Album,
  spotifyAlbums: SpotifyAlbumSimple[],
): SpotifyAlbumSimple | null {
  const localNorm = normalize(localAlbum.name);
  const localYear = localAlbum.year;

  // Score candidates and return the best match
  interface Candidate {
    album: SpotifyAlbumSimple;
    score: number;
  }

  const candidates: Candidate[] = [];

  for (const spot of spotifyAlbums) {
    const spotNorm = normalize(spot.name);
    const spotYear = Number.parseInt(spot.release_date.slice(0, 4), 10);
    let score = 0;

    // Name matching
    const exactName = spotNorm === localNorm;
    const containsMatch = spotNorm.includes(localNorm) || localNorm.includes(spotNorm);

    if (!exactName && !containsMatch) continue;

    if (exactName) score += 100;
    else if (containsMatch) score += 60;

    // Year matching
    if (localYear && !Number.isNaN(spotYear)) {
      const yearDiff = Math.abs(spotYear - localYear);
      if (yearDiff === 0) score += 50;
      else if (yearDiff === 1) score += 30;
      else if (yearDiff <= 3) score += 10;
      else score -= 20; // Big year gap — penalize
    } else if (!localYear) {
      // No local year — small bonus just for name match
      score += 5;
    }

    // Prefer standard editions (penalize deluxe/remaster unless local has those too)
    const localRaw = localAlbum.rawFolderName.toLowerCase();
    const spotLower = spot.name.toLowerCase();
    if (spotLower.match(/deluxe|expanded|super/) && !localRaw.match(/deluxe|expanded|super/)) {
      score -= 15;
    }

    // Prefer matching album types
    if (localAlbum.type === "compilation" && spot.album_type !== "compilation") {
      score -= 30;
    }
    if (localAlbum.type !== "compilation" && spot.album_type === "compilation") {
      score -= 30;
    }

    if (score > 0) {
      candidates.push({ album: spot, score });
    }
  }

  if (candidates.length === 0) return null;

  // Return highest scoring candidate
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].album;
}

// ─── Fetch Artist Albums from Spotify ───────────────────────────────────

async function fetchArtistAlbums(spotifyId: string): Promise<SpotifyAlbumSimple[]> {
  const allAlbums: SpotifyAlbumSimple[] = [];
  let url: string | null =
    `${SPOTIFY_CONFIG.API_BASE}/artists/${spotifyId}/albums?include_groups=album,single,compilation&limit=50`;

  interface ArtistAlbumsResponse {
    items: SpotifyAlbumSimple[];
    next: string | null;
  }

  while (url) {
    const data: ArtistAlbumsResponse | null = await spotifyGet<ArtistAlbumsResponse>(url);

    if (!data) break;
    allAlbums.push(...data.items);
    url = data.next;
  }

  return allAlbums;
}

// ─── Fetch Full Album Details (batch) ───────────────────────────────────

async function fetchAlbumsBatch(albumIds: string[]): Promise<SpotifyAlbumFull[]> {
  if (albumIds.length === 0) return [];

  // Spotify allows up to 20 albums per request
  const results: SpotifyAlbumFull[] = [];

  for (let i = 0; i < albumIds.length; i += 20) {
    const batch = albumIds.slice(i, i + 20);
    const ids = batch.join(",");
    const data = await spotifyGet<{ albums: SpotifyAlbumFull[] }>(
      `${SPOTIFY_CONFIG.API_BASE}/albums?ids=${ids}`,
    );

    if (data) {
      results.push(...data.albums.filter(Boolean));
    }
  }

  return results;
}

// ─── Album Art Download ─────────────────────────────────────────────────

function albumArtExists(artistSlug: string, albumSlug: string): boolean {
  const artPath = path.join(ROOT, ART_CONFIG.OUTPUT_DIR, artistSlug, `${albumSlug}.webp`);
  return fs.existsSync(artPath);
}

async function downloadAlbumArt(
  imageUrl: string,
  artistSlug: string,
  albumSlug: string,
): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;

    const buffer = Buffer.from(await response.arrayBuffer());

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
    console.warn(`  Failed to download art for ${artistSlug}/${albumSlug}: ${err}`);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const limit = Number.parseInt(
    process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0",
    10,
  );

  // Load music data
  const musicDataPath = path.join(ROOT, "data", "generated", "musicData.json");
  if (!fs.existsSync(musicDataPath)) {
    console.error("musicData.json not found. Run 'pnpm parse' first.");
    process.exit(1);
  }
  const musicData: MusicLibrary = JSON.parse(fs.readFileSync(musicDataPath, "utf-8"));

  // Load artist manifest
  const artistManifestPath = path.join(ROOT, SPOTIFY_CONFIG.MANIFEST_PATH);
  if (!fs.existsSync(artistManifestPath)) {
    console.error("spotifyArtistManifest.json not found. Run 'pnpm spotify' first.");
    process.exit(1);
  }
  const artistManifest: SpotifyArtistManifest = JSON.parse(
    fs.readFileSync(artistManifestPath, "utf-8"),
  );

  // Load existing album manifest (for incremental updates)
  const albumManifestPath = path.join(ROOT, SPOTIFY_CONFIG.ALBUM_MANIFEST_PATH);
  let manifest: SpotifyAlbumManifest = {
    generatedAt: "",
    totalArtistsQueried: 0,
    totalAlbumsMatched: 0,
    totalAlbumsUnmatched: 0,
    entries: {},
  };

  if (fs.existsSync(albumManifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(albumManifestPath, "utf-8"));
      const existingArtists = Object.keys(manifest.entries).length;
      console.log(`Loaded existing album manifest with ${existingArtists} artist entries.`);
    } catch {
      console.warn("Could not parse existing album manifest, starting fresh.");
    }
  }

  // Load album art manifest (for checking existing art)
  const artManifestPath = path.join(ROOT, ART_CONFIG.MANIFEST_PATH);
  let artManifest: ArtManifest = {
    generatedAt: "",
    musicLibraryRoot: "",
    totalAlbums: 0,
    albumsWithArt: 0,
    albumsWithoutArt: 0,
    entries: {},
  };

  if (fs.existsSync(artManifestPath)) {
    try {
      artManifest = JSON.parse(fs.readFileSync(artManifestPath, "utf-8"));
    } catch {
      console.warn("Could not parse album art manifest.");
    }
  }

  // Collect jobs using shared traversal
  let allJobs: ArtistJob[] = collectArtists(musicData, (artist) => {
    const spotifyEntry = artistManifest.entries[artist.slug];
    if (!spotifyEntry) return null; // No Spotify ID — skip
    return {
      slug: artist.slug,
      name: artist.name,
      spotifyId: spotifyEntry.spotifyId,
      albums: artist.albums,
    };
  });
  const totalArtists = allJobs.length;

  // Filter out already-processed artists
  const newJobs = allJobs.filter((job) => !(job.slug in manifest.entries));

  if (limit > 0) {
    allJobs = newJobs.slice(0, limit);
    console.log(`Limiting to ${limit} artists (--limit flag).`);
  } else {
    allJobs = newJobs;
  }

  console.log(`Artists with Spotify IDs: ${totalArtists}`);
  console.log(`Already processed: ${totalArtists - newJobs.length}`);
  console.log(`To process: ${allJobs.length}\n`);

  if (allJobs.length === 0) {
    console.log("Nothing to do — all artists already in manifest.");
    return;
  }

  await authenticate();

  let totalMatched = 0;
  let totalUnmatched = 0;
  let artDownloaded = 0;
  let artSkipped = 0;
  let processed = 0;

  // Process in batches
  for (let i = 0; i < allJobs.length; i += SPOTIFY_CONFIG.CONCURRENCY) {
    const batch = allJobs.slice(i, i + SPOTIFY_CONFIG.CONCURRENCY);

    await Promise.all(
      batch.map(async (job) => {
        try {
          // 1. Fetch artist's Spotify album catalog
          const spotifyAlbums = await fetchArtistAlbums(job.spotifyId);

          if (spotifyAlbums.length === 0) {
            totalUnmatched += job.albums.length;
            processed++;
            return;
          }

          // 2. Match local albums to Spotify albums
          const matchedIds: string[] = [];
          const matchMap = new Map<
            string,
            { localAlbum: Album; spotifyAlbum: SpotifyAlbumSimple }
          >();

          for (const localAlbum of job.albums) {
            const match = matchSpotifyAlbum(localAlbum, spotifyAlbums);
            if (match) {
              matchedIds.push(match.id);
              matchMap.set(match.id, {
                localAlbum,
                spotifyAlbum: match,
              });
              totalMatched++;
            } else {
              totalUnmatched++;
            }
          }

          // 3. Batch-fetch full album details (tracks + images)
          const fullAlbums = await fetchAlbumsBatch(matchedIds);

          // 4. Store results + download art
          if (!manifest.entries[job.slug]) {
            manifest.entries[job.slug] = {};
          }

          for (const fullAlbum of fullAlbums) {
            const matchInfo = matchMap.get(fullAlbum.id);
            if (!matchInfo) continue;

            const { localAlbum } = matchInfo;
            const imageUrl = fullAlbum.images.length > 0 ? fullAlbum.images[0].url : null;

            manifest.entries[job.slug][localAlbum.slug] = {
              albumSlug: localAlbum.slug,
              artistSlug: job.slug,
              spotifyAlbumId: fullAlbum.id,
              spotifyAlbumUrl: fullAlbum.external_urls.spotify,
              name: fullAlbum.name,
              releaseDate: fullAlbum.release_date,
              totalTracks: fullAlbum.total_tracks,
              imageUrl,
              tracks: fullAlbum.tracks.items.map((t) => ({
                name: t.name,
                trackNumber: t.track_number,
                discNumber: t.disc_number,
                durationMs: t.duration_ms,
                spotifyUrl: t.external_urls.spotify,
              })),
              fetchedAt: new Date().toISOString(),
            };

            // Download album art if missing locally
            if (imageUrl && !albumArtExists(job.slug, localAlbum.slug)) {
              const ok = await downloadAlbumArt(imageUrl, job.slug, localAlbum.slug);
              if (ok) {
                artDownloaded++;
                // Update art manifest
                if (!artManifest.entries[job.slug]) {
                  artManifest.entries[job.slug] = {};
                }
                artManifest.entries[job.slug][localAlbum.slug] = {
                  artistSlug: job.slug,
                  albumSlug: localAlbum.slug,
                  sourceFile: "spotify",
                };
              } else {
                artSkipped++;
              }
            }
          }

          processed++;
        } catch (err) {
          processed++;
          console.warn(`  ERROR for "${job.name}": ${err}`);
        }
      }),
    );

    // Progress report
    if (processed % 50 === 0 || processed === allJobs.length) {
      console.log(
        `  Progress: ${processed}/${allJobs.length} artists (${totalMatched} albums matched, ${totalUnmatched} unmatched, ${artDownloaded} art downloaded)`,
      );
    }

    // Checkpoint every 200 artists
    if (processed % 200 === 0 && processed > 0) {
      writeManifest(manifest, albumManifestPath, totalArtists);
      writeArtManifest(artManifest, artManifestPath);
      console.log("  Checkpoint saved.");
    }

    if (i + SPOTIFY_CONFIG.CONCURRENCY < allJobs.length) {
      await sleep(SPOTIFY_CONFIG.DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // Final write
  writeManifest(manifest, albumManifestPath, totalArtists);
  writeArtManifest(artManifest, artManifestPath);

  console.log("\nDone!");
  console.log(`Artists processed: ${processed}`);
  console.log(`Albums matched: ${totalMatched}`);
  console.log(`Albums unmatched: ${totalUnmatched}`);
  console.log(`Album art downloaded: ${artDownloaded}`);
  if (artSkipped > 0) console.log(`Album art failed: ${artSkipped}`);
  console.log(`Manifest: ${albumManifestPath}`);
}

function writeManifest(
  manifest: SpotifyAlbumManifest,
  manifestPath: string,
  totalArtists: number,
): void {
  let matched = 0;

  // Count totals from manifest entries
  for (const artistEntries of Object.values(manifest.entries)) {
    matched += Object.keys(artistEntries).length;
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.totalArtistsQueried = totalArtists;
  manifest.totalAlbumsMatched = matched;

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function writeArtManifest(manifest: ArtManifest, manifestPath: string): void {
  let total = 0;
  for (const artistEntries of Object.values(manifest.entries)) {
    total += Object.keys(artistEntries).length;
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.albumsWithArt = total;
  manifest.albumsWithoutArt = manifest.totalAlbums - total;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

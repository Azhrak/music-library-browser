import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ART_CONFIG } from "./albumArtConfig.js";
import { loadEnvVar } from "./spotify/spotifyAuth.js";
import { forEachArtistAndCompilation } from "./traversal.js";
import type { MusicLibrary } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ─── Types ──────────────────────────────────────────────────────────────

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

interface AlbumJob {
  artistSlug: string;
  albumSlug: string;
  fsPath: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getMusicLibraryRoot(): string {
  const root = loadEnvVar("MUSIC_LIBRARY_ROOT");
  if (root) return root;

  console.error("MUSIC_LIBRARY_ROOT not set. Set it in .env or as environment variable.");
  process.exit(1);
}

function findCoverImage(albumPath: string): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(albumPath);
  } catch {
    return null;
  }

  // Build case-insensitive lookup: lowercase basename (no ext) → original filename
  const fileMap = new Map<string, string>();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ART_CONFIG.SUPPORTED_EXTENSIONS.includes(ext)) {
      const baseLower = path.basename(file, path.extname(file)).toLowerCase();
      if (!fileMap.has(baseLower)) {
        fileMap.set(baseLower, file);
      }
    }
  }

  // Check priority filenames in order
  for (const priorityName of ART_CONFIG.PRIORITY_FILENAMES) {
    const found = fileMap.get(priorityName);
    if (found) return path.join(albumPath, found);
  }

  // Fallback: first image file alphabetically
  const allImages = files
    .filter((f) => ART_CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return allImages.length > 0 ? path.join(albumPath, allImages[0]) : null;
}

async function processImage(
  sourcePath: string,
  outputDir: string,
  albumSlug: string,
): Promise<boolean> {
  const outPath = path.join(outputDir, `${albumSlug}.webp`);

  // Idempotency: skip if output exists and is newer than source
  try {
    const sourceStats = fs.statSync(sourcePath);
    if (fs.existsSync(outPath)) {
      const outStats = fs.statSync(outPath);
      if (outStats.mtimeMs > sourceStats.mtimeMs) {
        return true;
      }
    }
  } catch {
    return false;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height) {
    return false;
  }

  if (
    metadata.width > ART_CONFIG.MAX_SOURCE_DIMENSION ||
    metadata.height > ART_CONFIG.MAX_SOURCE_DIMENSION
  ) {
    console.warn(`  SKIP (too large ${metadata.width}x${metadata.height}): ${sourcePath}`);
    return false;
  }

  // Generate single image (500x500, fit inside, preserve aspect ratio)
  await sharp(sourcePath)
    .resize(ART_CONFIG.IMAGE_SIZE, ART_CONFIG.IMAGE_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: ART_CONFIG.WEBP_QUALITY })
    .toFile(outPath);

  return true;
}

// ─── Job collection ─────────────────────────────────────────────────────

function collectJobs(musicData: MusicLibrary, musicRoot: string): AlbumJob[] {
  const jobs: AlbumJob[] = [];

  forEachArtistAndCompilation(
    musicData,
    (artist) => {
      const artistPath = path.join(musicRoot, ...artist.genrePath, artist.rawFolderName);
      for (const album of artist.albums) {
        jobs.push({
          artistSlug: artist.slug,
          albumSlug: album.slug,
          fsPath: path.join(artistPath, album.rawFolderName),
        });
      }
    },
    (comp) => {
      const compPath = path.join(musicRoot, ...comp.genrePath, comp.rawFolderName);
      for (const album of comp.albums) {
        jobs.push({
          artistSlug: comp.slug,
          albumSlug: album.slug,
          fsPath: path.join(compPath, album.rawFolderName),
        });
      }
    },
  );

  return jobs;
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const musicRoot = getMusicLibraryRoot();
  console.log(`Music library root: ${musicRoot}`);

  if (!fs.existsSync(musicRoot)) {
    console.error(`Music library root not found: ${musicRoot}`);
    process.exit(1);
  }

  const musicDataPath = path.join(ROOT, "data", "generated", "musicData.json");
  if (!fs.existsSync(musicDataPath)) {
    console.error("musicData.json not found. Run 'pnpm parse' first.");
    process.exit(1);
  }

  const musicData: MusicLibrary = JSON.parse(fs.readFileSync(musicDataPath, "utf-8"));
  const jobs = collectJobs(musicData, musicRoot);
  console.log(`Found ${jobs.length} albums to scan for art.\n`);

  const manifest: ArtManifest = {
    generatedAt: new Date().toISOString(),
    musicLibraryRoot: musicRoot,
    totalAlbums: jobs.length,
    albumsWithArt: 0,
    albumsWithoutArt: 0,
    entries: {},
  };

  const outputBase = path.join(ROOT, ART_CONFIG.OUTPUT_DIR);
  let processed = 0;
  let found = 0;
  let errors = 0;

  for (let i = 0; i < jobs.length; i += ART_CONFIG.CONCURRENCY) {
    const batch = jobs.slice(i, i + ART_CONFIG.CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        processed++;
        const coverPath = findCoverImage(job.fsPath);
        if (!coverPath) return;

        const artistOutputDir = path.join(outputBase, job.artistSlug);

        try {
          const ok = await processImage(coverPath, artistOutputDir, job.albumSlug);
          if (ok) {
            found++;
            if (!manifest.entries[job.artistSlug]) {
              manifest.entries[job.artistSlug] = {};
            }
            manifest.entries[job.artistSlug][job.albumSlug] = {
              artistSlug: job.artistSlug,
              albumSlug: job.albumSlug,
              sourceFile: path.basename(coverPath),
            };
          }
        } catch (err) {
          errors++;
          console.warn(`  ERROR processing ${coverPath}: ${err}`);
        }
      }),
    );

    if (processed % 500 === 0 || processed === jobs.length) {
      console.log(`  Progress: ${processed}/${jobs.length} scanned, ${found} with art`);
    }
  }

  manifest.albumsWithArt = found;
  manifest.albumsWithoutArt = jobs.length - found;

  const manifestPath = path.join(ROOT, ART_CONFIG.MANIFEST_PATH);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nDone!`);
  console.log(`Albums with art: ${found}/${jobs.length}`);
  console.log(`Albums without art: ${jobs.length - found}`);
  if (errors > 0) console.log(`Errors: ${errors}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

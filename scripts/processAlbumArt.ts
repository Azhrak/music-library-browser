import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ART_CONFIG } from "./albumArtConfig.js";
import type { Artist, Compilation, MusicLibrary, Subgenre } from "./types.js";

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
  const envRoot = process.env.MUSIC_LIBRARY_ROOT;
  if (envRoot) return envRoot;

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^MUSIC_LIBRARY_ROOT=(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }

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
  const thumbPath = path.join(outputDir, `${albumSlug}-thumb.webp`);
  const mediumPath = path.join(outputDir, `${albumSlug}-medium.webp`);

  // Idempotency: skip if both outputs exist and are newer than source
  try {
    const sourceStats = fs.statSync(sourcePath);
    if (fs.existsSync(thumbPath) && fs.existsSync(mediumPath)) {
      const thumbStats = fs.statSync(thumbPath);
      const mediumStats = fs.statSync(mediumPath);
      if (thumbStats.mtimeMs > sourceStats.mtimeMs && mediumStats.mtimeMs > sourceStats.mtimeMs) {
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

  if (metadata.width > ART_CONFIG.MAX_SOURCE_DIMENSION || metadata.height > ART_CONFIG.MAX_SOURCE_DIMENSION) {
    console.warn(`  SKIP (too large ${metadata.width}x${metadata.height}): ${sourcePath}`);
    return false;
  }

  // Generate thumbnail (square, cover-crop)
  await sharp(sourcePath)
    .resize(ART_CONFIG.THUMB_SIZE, ART_CONFIG.THUMB_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: ART_CONFIG.WEBP_QUALITY })
    .toFile(thumbPath);

  // Generate medium (fit inside, preserve aspect ratio)
  await sharp(sourcePath)
    .resize(ART_CONFIG.MEDIUM_SIZE, ART_CONFIG.MEDIUM_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: ART_CONFIG.WEBP_QUALITY })
    .toFile(mediumPath);

  return true;
}

// ─── Job collection ─────────────────────────────────────────────────────

function collectJobs(musicData: MusicLibrary, musicRoot: string): AlbumJob[] {
  const jobs: AlbumJob[] = [];

  function fromArtist(artist: Artist) {
    const artistPath = path.join(musicRoot, ...artist.genrePath, artist.rawFolderName);
    for (const album of artist.albums) {
      jobs.push({
        artistSlug: artist.slug,
        albumSlug: album.slug,
        fsPath: path.join(artistPath, album.rawFolderName),
      });
    }
  }

  function fromCompilation(comp: Compilation) {
    const compPath = path.join(musicRoot, ...comp.genrePath, comp.rawFolderName);
    for (const album of comp.albums) {
      jobs.push({
        artistSlug: comp.slug,
        albumSlug: album.slug,
        fsPath: path.join(compPath, album.rawFolderName),
      });
    }
  }

  function fromSubgenre(sg: Subgenre) {
    sg.artists.forEach(fromArtist);
    sg.compilations.forEach(fromCompilation);
    sg.subgenres.forEach(fromSubgenre);
  }

  for (const genre of musicData.genres) {
    genre.artists.forEach(fromArtist);
    genre.compilations.forEach(fromCompilation);
    genre.subgenres.forEach(fromSubgenre);
  }

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

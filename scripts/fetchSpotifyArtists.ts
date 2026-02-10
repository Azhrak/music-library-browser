import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTIFY_CONFIG } from "./spotifyConfig.js";
import type { Artist, MusicLibrary, Subgenre } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ─── Types ──────────────────────────────────────────────────────────────

interface SpotifyArtistEntry {
  artistSlug: string;
  spotifyUrl: string;
  spotifyId: string;
  fetchedAt: string;
}

interface SpotifyArtistManifest {
  generatedAt: string;
  totalQueried: number;
  matched: number;
  unmatched: number;
  entries: Record<string, SpotifyArtistEntry>;
}

interface ArtistJob {
  slug: string;
  name: string;
}

// ─── Environment ────────────────────────────────────────────────────────

function loadEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }

  return undefined;
}

// ─── Spotify Auth ───────────────────────────────────────────────────────

let accessToken = "";
let tokenExpiresAt = 0;

async function authenticate(): Promise<void> {
  const clientId = loadEnvVar("SPOTIFY_CLIENT_ID");
  const clientSecret = loadEnvVar("SPOTIFY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error(
      "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env or as environment variables.",
    );
    console.error("Get credentials at https://developer.spotify.com/dashboard");
    process.exit(1);
  }

  const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Spotify auth failed (${response.status}): ${text}`);
    process.exit(1);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  // Refresh 60s before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  console.log("Spotify authentication successful.\n");
}

async function ensureAuth(): Promise<void> {
  if (Date.now() >= tokenExpiresAt) {
    console.log("Refreshing Spotify token...");
    await authenticate();
  }
}

// ─── Spotify API ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchArtist(
  artistName: string,
): Promise<{ spotifyId: string; spotifyUrl: string } | null> {
  await ensureAuth();

  const url = `${SPOTIFY_CONFIG.API_BASE}/search?q=${encodeURIComponent(artistName)}&type=artist&limit=5`;

  for (let attempt = 0; attempt < SPOTIFY_CONFIG.MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "5", 10);
      console.warn(`  Rate limited. Waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!response.ok) {
      console.warn(`  Spotify search failed (${response.status}) for "${artistName}"`);
      return null;
    }

    const data = (await response.json()) as {
      artists: {
        items: Array<{
          id: string;
          name: string;
          external_urls: { spotify: string };
        }>;
      };
    };

    const items = data.artists.items;
    if (items.length === 0) return null;

    const normalizedQuery = normalize(artistName);

    // Exact match first
    const exact = items.find((item) => normalize(item.name) === normalizedQuery);
    if (exact) {
      return { spotifyId: exact.id, spotifyUrl: exact.external_urls.spotify };
    }

    // If no exact match, take the first result only if it's close enough
    const first = items[0];
    const firstNorm = normalize(first.name);
    if (
      firstNorm.includes(normalizedQuery) ||
      normalizedQuery.includes(firstNorm)
    ) {
      return { spotifyId: first.id, spotifyUrl: first.external_urls.spotify };
    }

    return null;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Job Collection ─────────────────────────────────────────────────────

function collectArtists(musicData: MusicLibrary): ArtistJob[] {
  const seen = new Set<string>();
  const jobs: ArtistJob[] = [];

  function addArtist(artist: Artist) {
    if (seen.has(artist.slug)) return;
    seen.add(artist.slug);
    jobs.push({ slug: artist.slug, name: artist.name });
  }

  function fromSubgenre(sg: Subgenre) {
    sg.artists.forEach(addArtist);
    sg.subgenres.forEach(fromSubgenre);
  }

  for (const genre of musicData.genres) {
    genre.artists.forEach(addArtist);
    genre.subgenres.forEach(fromSubgenre);
  }

  return jobs;
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const musicDataPath = path.join(ROOT, "data", "generated", "musicData.json");
  if (!fs.existsSync(musicDataPath)) {
    console.error("musicData.json not found. Run 'pnpm parse' first.");
    process.exit(1);
  }

  const musicData: MusicLibrary = JSON.parse(
    fs.readFileSync(musicDataPath, "utf-8"),
  );

  // Load existing manifest to skip already-fetched artists
  const manifestPath = path.join(ROOT, SPOTIFY_CONFIG.MANIFEST_PATH);
  let existingManifest: SpotifyArtistManifest = {
    generatedAt: "",
    totalQueried: 0,
    matched: 0,
    unmatched: 0,
    entries: {},
  };

  if (fs.existsSync(manifestPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      console.log(
        `Loaded existing manifest with ${Object.keys(existingManifest.entries).length} entries.`,
      );
    } catch {
      console.warn("Could not parse existing manifest, starting fresh.");
    }
  }

  const allArtists = collectArtists(musicData);
  const newJobs = allArtists.filter(
    (artist) => !(artist.slug in existingManifest.entries),
  );

  console.log(`Total artists: ${allArtists.length}`);
  console.log(`Already fetched: ${allArtists.length - newJobs.length}`);
  console.log(`To fetch: ${newJobs.length}\n`);

  if (newJobs.length === 0) {
    console.log("Nothing to do — all artists already in manifest.");
    return;
  }

  await authenticate();

  let matched = 0;
  let unmatched = 0;
  let errors = 0;
  let processed = 0;

  // Process in batches
  for (let i = 0; i < newJobs.length; i += SPOTIFY_CONFIG.CONCURRENCY) {
    const batch = newJobs.slice(i, i + SPOTIFY_CONFIG.CONCURRENCY);

    await Promise.all(
      batch.map(async (job) => {
        try {
          const result = await searchArtist(job.name);
          processed++;

          if (result) {
            matched++;
            existingManifest.entries[job.slug] = {
              artistSlug: job.slug,
              spotifyUrl: result.spotifyUrl,
              spotifyId: result.spotifyId,
              fetchedAt: new Date().toISOString(),
            };
          } else {
            unmatched++;
          }
        } catch (err) {
          processed++;
          errors++;
          console.warn(`  ERROR for "${job.name}": ${err}`);
        }
      }),
    );

    // Progress report
    if (processed % 100 === 0 || processed === newJobs.length) {
      console.log(
        `  Progress: ${processed}/${newJobs.length} (${matched} matched, ${unmatched} unmatched)`,
      );
    }

    // Save checkpoint every 500 artists
    if (processed % 500 === 0 && processed > 0) {
      writeManifest(existingManifest, manifestPath, allArtists.length, matched, unmatched);
      console.log("  Checkpoint saved.");
    }

    if (i + SPOTIFY_CONFIG.CONCURRENCY < newJobs.length) {
      await sleep(SPOTIFY_CONFIG.DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // Final manifest write
  writeManifest(existingManifest, manifestPath, allArtists.length, matched, unmatched);

  console.log("\nDone!");
  console.log(`New artists queried: ${processed}`);
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  if (errors > 0) console.log(`Errors: ${errors}`);
  console.log(
    `Total in manifest: ${Object.keys(existingManifest.entries).length}/${allArtists.length}`,
  );
  console.log(`Manifest: ${manifestPath}`);
}

function writeManifest(
  manifest: SpotifyArtistManifest,
  manifestPath: string,
  totalArtists: number,
  newMatched: number,
  newUnmatched: number,
): void {
  const totalEntries = Object.keys(manifest.entries).length;
  manifest.generatedAt = new Date().toISOString();
  manifest.totalQueried = totalArtists;
  manifest.matched = totalEntries;
  manifest.unmatched = totalArtists - totalEntries;

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

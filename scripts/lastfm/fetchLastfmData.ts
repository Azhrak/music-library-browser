/**
 * Fetches all-time scrobble data from Last.fm for user "azhrak" and matches
 * it against the local music library (musicData.json) by artist/album slug.
 *
 * Output: data/generated/lastfmManifest.json
 *
 * Usage: pnpm lastfm
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LASTFM_CONFIG } from "./lastfmConfig.js";
import type { MusicLibrary, Artist } from "../types.js";
import type { LastfmManifest, LastfmArtistEntry, LastfmAlbumEntry } from "../../src/lib/lastfmTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

// ─── Environment ─────────────────────────────────────────────────────────────

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a name for fuzzy matching: lowercase, strip leading "the",
 * remove all non-alphanumeric characters.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^the /, "")
    .replace(/[^a-z0-9]/g, "");
}

// ─── Last.fm API ──────────────────────────────────────────────────────────────

interface LastfmArtistRaw {
  name: string;
  playcount: string;
  "@attr": { rank: string };
}

interface LastfmAlbumRaw {
  name: string;
  playcount: string;
  artist: { name: string };
}

interface LastfmPageAttr {
  page: string;
  totalPages: string;
  total: string;
}

async function fetchTopArtists(apiKey: string): Promise<LastfmArtistRaw[]> {
  const results: LastfmArtistRaw[] = [];
  let page = 1;
  let totalPages = 1;

  console.log("Fetching top artists from Last.fm...");

  do {
    const url = `${LASTFM_CONFIG.API_BASE}/?method=user.getTopArtists&user=${LASTFM_CONFIG.USER}&api_key=${apiKey}&format=json&limit=${LASTFM_CONFIG.LIMIT}&page=${page}&period=overall`;
    const res = await fetch(url, { headers: { "User-Agent": "MusicLibraryBrowser/1.0" } });

    if (!res.ok) {
      console.error(`  Last.fm artist fetch failed (${res.status}) on page ${page}`);
      break;
    }

    const data = (await res.json()) as { topartists: { artist: LastfmArtistRaw[]; "@attr": LastfmPageAttr } };
    const { artist: artists, "@attr": attr } = data.topartists;

    results.push(...artists);
    totalPages = Number.parseInt(attr.totalPages, 10);

    const pct = Math.round((page / totalPages) * 100);
    process.stdout.write(`  Page ${page}/${totalPages} (${pct}%) — ${results.length} artists so far\r`);

    page++;
    if (page <= totalPages) await sleep(LASTFM_CONFIG.DELAY_MS);
  } while (page <= totalPages);

  console.log(`\n  Done. Fetched ${results.length} artists total.`);
  return results;
}

async function fetchTopAlbums(apiKey: string): Promise<LastfmAlbumRaw[]> {
  const results: LastfmAlbumRaw[] = [];
  let page = 1;
  let totalPages = 1;

  console.log("\nFetching top albums from Last.fm...");

  do {
    const url = `${LASTFM_CONFIG.API_BASE}/?method=user.getTopAlbums&user=${LASTFM_CONFIG.USER}&api_key=${apiKey}&format=json&limit=${LASTFM_CONFIG.LIMIT}&page=${page}&period=overall`;
    const res = await fetch(url, { headers: { "User-Agent": "MusicLibraryBrowser/1.0" } });

    if (!res.ok) {
      console.error(`  Last.fm album fetch failed (${res.status}) on page ${page}`);
      break;
    }

    const data = (await res.json()) as { topalbums: { album: LastfmAlbumRaw[]; "@attr": LastfmPageAttr } };
    const { album: albums, "@attr": attr } = data.topalbums;

    results.push(...albums);
    totalPages = Number.parseInt(attr.totalPages, 10);

    const pct = Math.round((page / totalPages) * 100);
    process.stdout.write(`  Page ${page}/${totalPages} (${pct}%) — ${results.length} albums so far\r`);

    page++;
    if (page <= totalPages) await sleep(LASTFM_CONFIG.DELAY_MS);
  } while (page <= totalPages);

  console.log(`\n  Done. Fetched ${results.length} albums total.`);
  return results;
}

// ─── Music Library Lookup Maps ────────────────────────────────────────────────

function buildLookupMaps(library: MusicLibrary): {
  artistMap: Map<string, string>; // normalized name → slug
  albumMap: Map<string, Map<string, string>>; // artistSlug → (normalized album name → albumSlug)
  allArtists: Artist[];
} {
  const artistMap = new Map<string, string>();
  const albumMap = new Map<string, Map<string, string>>();
  const allArtists: Artist[] = [];

  function processArtist(artist: Artist) {
    allArtists.push(artist);
    const key = normalize(artist.name);
    // Don't overwrite if already present (keep first match for duplicate normalized names)
    if (!artistMap.has(key)) {
      artistMap.set(key, artist.slug);
    }

    const albums = new Map<string, string>();
    for (const album of artist.albums) {
      const albumKey = normalize(album.name);
      if (!albums.has(albumKey)) {
        albums.set(albumKey, album.slug);
      }
    }
    albumMap.set(artist.slug, albums);
  }

  function processSubgenre(sg: { artists: Artist[]; subgenres: typeof sg[] }) {
    sg.artists.forEach(processArtist);
    sg.subgenres.forEach(processSubgenre);
  }

  for (const genre of library.genres) {
    genre.artists.forEach(processArtist);
    genre.subgenres.forEach(processSubgenre);
  }

  return { artistMap, albumMap, allArtists };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = loadEnvVar("LASTFM_API_KEY");
  if (!apiKey) {
    console.error("LASTFM_API_KEY must be set in .env or as an environment variable.");
    console.error("Get your API key at https://www.last.fm/api/account/create");
    process.exit(1);
  }

  // Load music library data
  const musicDataPath = path.join(ROOT, "data/generated/musicData.json");
  if (!fs.existsSync(musicDataPath)) {
    console.error(`musicData.json not found at ${musicDataPath}`);
    console.error("Run `pnpm parse` first to generate it.");
    process.exit(1);
  }
  const library = JSON.parse(fs.readFileSync(musicDataPath, "utf-8")) as MusicLibrary;

  // Build lookup maps
  console.log("Building lookup maps from music library...");
  const { artistMap, albumMap, allArtists } = buildLookupMaps(library);
  console.log(`  ${allArtists.length} artists, ${albumMap.size} album maps built.\n`);

  // Fetch from Last.fm
  const [rawArtists, rawAlbums] = await Promise.all([
    fetchTopArtists(apiKey),
    fetchTopAlbums(apiKey),
  ]);

  // Match artists
  console.log("\nMatching artists...");
  const artists: Record<string, LastfmArtistEntry> = {};
  let artistMatched = 0;
  let artistUnmatched = 0;

  for (const raw of rawArtists) {
    const key = normalize(raw.name);
    const slug = artistMap.get(key);
    if (slug) {
      artists[slug] = {
        playcount: Number.parseInt(raw.playcount, 10),
        rank: Number.parseInt(raw["@attr"].rank, 10),
      };
      artistMatched++;
    } else {
      artistUnmatched++;
    }
  }
  console.log(`  Matched: ${artistMatched}, Unmatched: ${artistUnmatched}`);

  // Match albums
  console.log("\nMatching albums...");
  const albums: Record<string, Record<string, LastfmAlbumEntry>> = {};
  let albumMatched = 0;
  let albumUnmatched = 0;

  for (const raw of rawAlbums) {
    const artistKey = normalize(raw.artist.name);
    const artistSlug = artistMap.get(artistKey);
    if (!artistSlug) {
      albumUnmatched++;
      continue;
    }

    const albumsForArtist = albumMap.get(artistSlug);
    if (!albumsForArtist) {
      albumUnmatched++;
      continue;
    }

    const albumKey = normalize(raw.name);
    const albumSlug = albumsForArtist.get(albumKey);
    if (!albumSlug) {
      albumUnmatched++;
      continue;
    }

    if (!albums[artistSlug]) albums[artistSlug] = {};
    albums[artistSlug][albumSlug] = {
      playcount: Number.parseInt(raw.playcount, 10),
    };
    albumMatched++;
  }
  console.log(`  Matched: ${albumMatched}, Unmatched: ${albumUnmatched}`);

  // Write manifest
  const manifest: LastfmManifest = {
    generatedAt: new Date().toISOString(),
    user: LASTFM_CONFIG.USER,
    artists,
    albums,
  };

  const outPath = path.join(ROOT, LASTFM_CONFIG.MANIFEST_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\nManifest written to ${LASTFM_CONFIG.MANIFEST_PATH}`);
  console.log(`  Artists: ${Object.keys(artists).length}`);
  console.log(`  Artists with albums: ${Object.keys(albums).length}`);
  console.log(`  Total album entries: ${Object.values(albums).reduce((s, a) => s + Object.keys(a).length, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

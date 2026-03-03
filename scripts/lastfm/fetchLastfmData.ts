/**
 * Fetches all-time scrobble data from Last.fm for the user set in LASTFM_USER and matches
 * it against the local music library (musicData.json) by artist/album slug.
 *
 * Output: data/generated/lastfmManifest.json
 *
 * Usage: pnpm lastfm
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  LastfmAlbumEntry,
  LastfmArtistEntry,
  LastfmManifest,
} from "../../src/lib/lastfmTypes.js";
import { loadEnvVar, sleep } from "../spotify/spotifyAuth.js";
import type { Artist, MusicLibrary } from "../types.js";
import { LASTFM_CONFIG } from "./lastfmConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

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

async function fetchTopItems<T>(
  apiKey: string,
  user: string,
  method: string,
  responseKey: string,
  itemKey: string,
  label: string,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let totalPages = 1;

  console.log(`Fetching top ${label} from Last.fm...`);

  do {
    const url = `${LASTFM_CONFIG.API_BASE}/?method=${method}&user=${user}&api_key=${apiKey}&format=json&limit=${LASTFM_CONFIG.LIMIT}&page=${page}&period=overall`;
    const res = await fetch(url, { headers: { "User-Agent": "MusicLibraryBrowser/1.0" } });

    if (!res.ok) {
      console.error(`  Last.fm ${label} fetch failed (${res.status}) on page ${page}`);
      break;
    }

    const data = (await res.json()) as Record<string, Record<string, unknown>>;
    const section = data[responseKey];
    const items = section[itemKey] as T[];
    const attr = section["@attr"] as LastfmPageAttr;

    results.push(...items);
    totalPages = Number.parseInt(attr.totalPages, 10);

    const pct = Math.round((page / totalPages) * 100);
    process.stdout.write(
      `  Page ${page}/${totalPages} (${pct}%) — ${results.length} ${label} so far\r`,
    );

    page++;
    if (page <= totalPages) await sleep(LASTFM_CONFIG.DELAY_MS);
  } while (page <= totalPages);

  console.log(`\n  Done. Fetched ${results.length} ${label} total.`);
  return results;
}

function fetchTopArtists(apiKey: string, user: string): Promise<LastfmArtistRaw[]> {
  return fetchTopItems<LastfmArtistRaw>(
    apiKey,
    user,
    "user.getTopArtists",
    "topartists",
    "artist",
    "artists",
  );
}

function fetchTopAlbums(apiKey: string, user: string): Promise<LastfmAlbumRaw[]> {
  return fetchTopItems<LastfmAlbumRaw>(apiKey, user, "user.getTopAlbums", "topalbums", "album", "albums");
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

  function processSubgenre(sg: { artists: Artist[]; subgenres: (typeof sg)[] }) {
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

  const user = loadEnvVar("LASTFM_USER");
  if (!user) {
    console.error("LASTFM_USER must be set in .env or as an environment variable.");
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
    fetchTopArtists(apiKey, user),
    fetchTopAlbums(apiKey, user),
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
    user,
    artists,
    albums,
  };

  const outPath = path.join(ROOT, LASTFM_CONFIG.MANIFEST_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\nManifest written to ${LASTFM_CONFIG.MANIFEST_PATH}`);
  console.log(`  Artists: ${Object.keys(artists).length}`);
  console.log(`  Artists with albums: ${Object.keys(albums).length}`);
  console.log(
    `  Total album entries: ${Object.values(albums).reduce((s, a) => s + Object.keys(a).length, 0)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

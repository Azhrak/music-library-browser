import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify, uniqueSlug } from "../src/lib/slugify.js";
import {
  ARTIST_TAGS,
  FALSE_POSITIVE_CODES,
  isCountryCode,
  resolveCountry,
  resolveIsoCodes,
  resolveMultiCountry,
} from "./countryMapping.js";
import {
  type Album,
  type Artist,
  type Compilation,
  type Genre,
  type MusicLibrary,
  ReleaseType,
  type SearchEntry,
  type Subgenre,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Folders to skip (matching existing parser behavior)
const IGNORED_GENRES = new Set(["Downloads", "Various", "Classical", "No Copyright"]);

// ─── Folder hierarchy type ──────────────────────────────────────────────
interface FolderNode {
  [key: string]: FolderNode;
}

// ─── Artist name parsing ────────────────────────────────────────────────

interface ParsedArtistName {
  name: string;
  countryCode: string | null;
  country: string | null;
  tags: string[];
}

function parseArtistName(folderName: string): ParsedArtistName {
  let remaining = folderName.trim();
  const tags: string[] = [];

  // Extract trailing artist tags: (later), (early), (acoustic), etc.
  // These appear after the country code
  const tagRegex = /\s*\(([^)]+)\)\s*$/;
  let match: RegExpMatchArray | null;

  // Peel tags from the end, one at a time
  match = remaining.match(tagRegex);
  while (match) {
    const value = match[1];
    if (ARTIST_TAGS.has(value.toLowerCase())) {
      tags.unshift(value.toLowerCase());
      remaining = remaining.slice(0, match.index ?? 0).trim();
    } else {
      break; // not a tag, stop peeling
    }
    match = remaining.match(tagRegex);
  }

  // Now try to extract country code from the end
  let countryCode: string | null = null;

  // Multi-country: (Aut-UK), (Isr&UK)
  const multiMatch = remaining.match(/\s*\((\w{2,3}[-&]\w{2,3})\)\s*$/);
  if (multiMatch) {
    countryCode = multiMatch[1];
    remaining = remaining.slice(0, multiMatch.index ?? 0).trim();
    return {
      name: remaining,
      countryCode,
      country: resolveMultiCountry(countryCode),
      tags,
    };
  }

  // Single country code: (XX) or (XXX)
  const countryMatch = remaining.match(/\s*\((\w{2,3})\)\s*$/);
  if (countryMatch) {
    const code = countryMatch[1];
    if (!FALSE_POSITIVE_CODES.has(code) && isCountryCode(code)) {
      countryCode = code;
      remaining = remaining.slice(0, countryMatch.index ?? 0).trim();
    }
  }

  // Handle descriptive paren before country: "Name (Description) (Code)"
  // already handled since we peel from the end

  return {
    name: remaining,
    countryCode,
    country: resolveCountry(countryCode),
    tags,
  };
}

// ─── Release name formatting (adapted from existing parseMusicFolders.ts) ─

function formatReleaseName(releaseName: string): string {
  return releaseName
    .trim()
    .replace(/\[\d+\]/, "") // Remove year in brackets
    .replace(/\(Lossless\)/i, "")
    .replace(/- Lossless/i, "")
    .replace(/\(later\)/gi, "")
    .replace(/\(early\)/gi, "")
    .replace(/\(Demo\)/i, "")
    .replace(/\(Promo\)/i, "")
    .replace(/- Promo/i, "")
    .replace(/\(Remastered\)/i, "")
    .replace(/\(Reissue\)/i, "")
    .replace(/\(Deluxe\)/i, "")
    .replace(/\(Limited Edition\)/i, "")
    .replace(/\(Bonus Tracks?\)/i, "")
    .replace(/\(Digipak\)/i, "")
    .replace(/\(Digipack\)/i, "")
    .replace(/\(Digibook\)/i, "")
    .replace(/\(Boxset\)/i, "")
    .replace(/\(Box Set\)/i, "")
    .replace(/\(Special Edition\)/i, "")
    .replace(/\(Anniversary Edition\)/i, "")
    .replace(/\(\d+th Anniversary[^)]*\)/i, "")
    .replace(/\(Reissue \d+\)/i, "")
    .replace(/-\s*\d+\s*kbps/i, "")
    .replace(/\s+\d+\s*kbps/i, "")
    .replace(/\s+-\s+\d+\s*kbps/i, "")
    .replace(/ -\s*(EP|Live|Single|Compilation|Demo|Split|CDS)/i, "")
    .replace(/\(disc \d+\)/i, "")
    .replace(/\(CD\d+\)/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Release type detection (adapted from existing parseMusicFolders.ts) ─

function getReleaseType(releaseName: string): ReleaseType {
  const lower = releaseName.toLowerCase();

  // Explicit markers with dash
  const dashMatch = releaseName.match(/ -\s*(EP|Live|Single|Compilation|Demo|Split)/i);
  if (dashMatch) {
    const key = dashMatch[1].toLowerCase();
    const map: Record<string, ReleaseType> = {
      ep: ReleaseType.EP,
      live: ReleaseType.Live,
      single: ReleaseType.Single,
      compilation: ReleaseType.Compilation,
      demo: ReleaseType.Demo,
      split: ReleaseType.Split,
    };
    return map[key] ?? ReleaseType.Album;
  }

  // Parenthetical markers
  if (/\(EP\)/i.test(releaseName)) return ReleaseType.EP;
  if (/\(Single\)/i.test(releaseName)) return ReleaseType.Single;
  if (/\(Demo\)/i.test(releaseName)) return ReleaseType.Demo;
  if (/\(Live\)/i.test(releaseName)) return ReleaseType.Live;
  if (/\(Compilation\)/i.test(releaseName)) return ReleaseType.Compilation;
  if (/\(Split\)/i.test(releaseName)) return ReleaseType.Split;
  if (/ CDS$/.test(releaseName)) return ReleaseType.Single;

  // Content-based detection
  if (lower.includes("demo")) return ReleaseType.Demo;
  if (lower.includes("live at") || lower.includes("live in")) return ReleaseType.Live;
  if (lower.includes("split with")) return ReleaseType.Split;

  return ReleaseType.Album;
}

// ─── Reissue detection ──────────────────────────────────────────────────

const REISSUE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\(Remastered\)/i, label: "Remastered" },
  { pattern: /\(Remaster\)/i, label: "Remastered" },
  { pattern: /\(Re-Mastered\)/i, label: "Remastered" },
  { pattern: /\(Reissue[^)]*\)/i, label: "Reissue" },
  { pattern: /\(Rereleased[^)]*\)/i, label: "Reissue" },
  { pattern: /\(\d+th Anniversary[^)]*\)/i, label: "Anniversary Edition" },
  { pattern: /\(Deluxe\)/i, label: "Deluxe Edition" },
  { pattern: /\(Special Edition\)/i, label: "Special Edition" },
  { pattern: /\(Limited Edition\)/i, label: "Limited Edition" },
  { pattern: /\(Bonus Tracks?\)/i, label: "Bonus Tracks" },
];

function detectReissueTag(rawName: string): string | undefined {
  for (const { pattern, label } of REISSUE_PATTERNS) {
    if (pattern.test(rawName)) return label;
  }
  return undefined;
}

// ─── Album extraction ───────────────────────────────────────────────────

function extractAlbums(children: FolderNode, artistSlugSet: Set<string>): Album[] {
  const raw = Object.entries(children)
    .map(([name, subChildren]) => {
      const yearMatch = name.match(/\[(\d{4})\]/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
      const type = getReleaseType(name);
      const cleanName = formatReleaseName(name);
      const reissue = detectReissueTag(name);

      const childKeys = Object.keys(subChildren);
      const discPattern = /^(CD\s?\d|Disc\s?\d|Book\s?\d)/i;
      const discChildren = childKeys.filter((k) => discPattern.test(k));

      return {
        name: cleanName,
        slug: "", // assigned after dedup
        year,
        type,
        reissue,
        hasMultipleDiscs: discChildren.length > 1,
        discCount: Math.max(discChildren.length, 1),
        rawFolderName: name,
      };
    })
    .filter((album) => album.name.length > 0)
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  // Deduplicate: same name + same year = format duplicate (mp3 vs lossless), keep one.
  // Same name + different year = reissue/remaster, keep both but mark the later one.
  const deduped: typeof raw = [];
  const seenByName = new Map<string, (typeof raw)[0]>();

  for (const album of raw) {
    const existing = seenByName.get(album.name);
    if (!existing) {
      seenByName.set(album.name, album);
      deduped.push(album);
      continue;
    }

    if (existing.year === album.year) {
      // Same name, same year → format duplicate, skip
      continue;
    }

    // Same name, different year → keep as reissue
    if (!album.reissue) {
      album.reissue = "Reissue";
    }
    deduped.push(album);
  }

  // Assign slugs after dedup
  for (const album of deduped) {
    album.slug = uniqueSlug(album.name + (album.year ? `-${album.year}` : ""), artistSlugSet);
  }

  return deduped;
}

// ─── Node classification ────────────────────────────────────────────────

type NodeType = "subgenre" | "artist" | "compilation" | "album" | "ignore";

function classifyNode(
  name: string,
  children: FolderNode,
  parentType: "root" | "genre" | "subgenre" | "artist" | "compilation",
): NodeType {
  // 1. If parent is artist or compilation, children are albums
  if (parentType === "artist" || parentType === "compilation") {
    return "album";
  }

  // 2. VA compilation check
  if (name.startsWith("- VA -") || name.startsWith("- Various Artists")) {
    return "compilation";
  }

  // 3. Skip Windows shortcuts and non-folder artifacts
  if (name.endsWith(".lnk") || name.match(/\.(mp3|aac|wav|flac|ogg|m4a)$/i)) {
    return "ignore";
  }

  // 4. Country code match at end of name
  const countryEndMatch = name.match(/\((\w{2,3})\)\s*$/);
  if (countryEndMatch) {
    const code = countryEndMatch[1];
    if (!FALSE_POSITIVE_CODES.has(code) && isCountryCode(code)) {
      return "artist";
    }
  }

  // 5. Multi-paren: "Name (Code) (tag)" pattern
  const multiParenMatch = name.match(/\((\w{2,3})\)\s*\([^)]+\)\s*$/);
  if (multiParenMatch) {
    const code = multiParenMatch[1];
    if (!FALSE_POSITIVE_CODES.has(code) && isCountryCode(code)) {
      return "artist";
    }
  }

  // 6. Multi-country: (Aut-UK), (Isr&UK)
  if (name.match(/\(\w{2,3}[-&]\w{2,3}\)\s*$/)) {
    return "artist";
  }

  // 7. Descriptive paren then country: "Name (desc) (Code)"
  const descCountryMatch = name.match(/\([^)]+\)\s*\((\w{2,3})\)\s*$/);
  if (descCountryMatch) {
    const code = descCountryMatch[1];
    if (!FALSE_POSITIVE_CODES.has(code) && isCountryCode(code)) {
      return "artist";
    }
  }

  // 8. Children heuristic: if children look like albums (have [YYYY] prefix),
  //    treat this as an artist without a country code
  const childKeys = Object.keys(children);
  if (childKeys.length > 0) {
    const albumLikeChildren = childKeys.filter((k) => /^\[\d{4}\]/.test(k));
    if (albumLikeChildren.length > 0 && albumLikeChildren.length >= childKeys.length * 0.3) {
      return "artist";
    }
  }

  // 9. Default: subgenre if has children, ignore if empty
  if (childKeys.length > 0) {
    return "subgenre";
  }

  return "ignore";
}

// ─── Recursive hierarchy walker ─────────────────────────────────────────

interface WalkResult {
  artists: Artist[];
  compilations: Compilation[];
  subgenres: Subgenre[];
}

const globalArtistSlugs = new Set<string>();
const globalAlbumSlugs = new Set<string>();

function walkHierarchy(
  node: FolderNode,
  genrePath: string[],
  parentType: "root" | "genre" | "subgenre" | "artist" | "compilation",
): WalkResult {
  const artists: Artist[] = [];
  const compilations: Compilation[] = [];
  const subgenres: Subgenre[] = [];

  for (const [name, children] of Object.entries(node)) {
    const nodeType = classifyNode(name, children, parentType);

    switch (nodeType) {
      case "artist": {
        const parsed = parseArtistName(name);
        const albums = extractAlbums(children, globalAlbumSlugs);
        artists.push({
          name: parsed.name,
          slug: uniqueSlug(parsed.name, globalArtistSlugs, parsed.countryCode ?? undefined),
          countryCode: parsed.countryCode,
          country: parsed.country,
          isoCodes: resolveIsoCodes(parsed.countryCode),
          tags: parsed.tags,
          genrePath: [...genrePath],
          albums,
          rawFolderName: name,
        });
        break;
      }

      case "compilation": {
        const cleanName = name
          .replace(/^- VA -\s*/, "")
          .replace(/^- Various Artists -?\s*/, "")
          .trim();
        const albums = extractAlbums(children, globalAlbumSlugs);
        compilations.push({
          name: cleanName || name,
          slug: uniqueSlug(cleanName || name, globalArtistSlugs),
          genrePath: [...genrePath],
          albums,
          rawFolderName: name,
        });
        break;
      }

      case "subgenre": {
        const result = walkHierarchy(children, [...genrePath, name], "subgenre");
        subgenres.push({
          name,
          slug: slugify(name),
          fullPath: [...genrePath, name],
          subgenres: result.subgenres,
          artists: result.artists,
          compilations: result.compilations,
        });
        break;
      }

      case "ignore":
        break;
    }
  }

  return { artists, compilations, subgenres };
}

// ─── Stats collection ───────────────────────────────────────────────────

function countStats(genres: Genre[]) {
  let totalArtists = 0;
  let totalAlbums = 0;
  let totalCompilations = 0;
  let totalSubgenres = 0;

  function countSubgenre(sg: Subgenre) {
    totalSubgenres++;
    totalArtists += sg.artists.length;
    totalAlbums += sg.artists.reduce((sum, a) => sum + a.albums.length, 0);
    totalCompilations += sg.compilations.length;
    totalAlbums += sg.compilations.reduce((sum, c) => sum + c.albums.length, 0);
    sg.subgenres.forEach(countSubgenre);
  }

  for (const genre of genres) {
    totalArtists += genre.artists.length;
    totalAlbums += genre.artists.reduce((sum, a) => sum + a.albums.length, 0);
    totalCompilations += genre.compilations.length;
    totalAlbums += genre.compilations.reduce((sum, c) => sum + c.albums.length, 0);
    genre.subgenres.forEach(countSubgenre);
  }

  return {
    totalGenres: genres.length,
    totalSubgenres,
    totalArtists,
    totalAlbums,
    totalCompilations,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Search index generation ────────────────────────────────────────────

function buildSearchIndex(genres: Genre[]): SearchEntry[] {
  const entries: SearchEntry[] = [];

  function indexArtist(artist: Artist) {
    entries.push({
      type: "artist",
      name: artist.name,
      country: artist.country,
      isoCodes: artist.isoCodes,
      genrePath: artist.genrePath.join(" > "),
      slug: artist.slug,
      url: `/artist/${artist.slug}`,
      albumCount: artist.albums.length,
    });

    for (const album of artist.albums) {
      entries.push({
        type: "album",
        name: album.name,
        artist: artist.name,
        year: album.year,
        genrePath: artist.genrePath.join(" > "),
        slug: album.slug,
        url: `/artist/${artist.slug}/${album.slug}`,
      });
    }
  }

  function indexSubgenre(sg: Subgenre) {
    entries.push({
      type: "genre",
      name: sg.fullPath.join(" > "),
      genrePath: sg.fullPath.join(" > "),
      slug: sg.slug,
      url: `/genre/${sg.fullPath.map((p) => slugify(p)).join("/")}`,
    });
    sg.artists.forEach(indexArtist);
    sg.subgenres.forEach(indexSubgenre);
  }

  for (const genre of genres) {
    entries.push({
      type: "genre",
      name: genre.name,
      genrePath: genre.name,
      slug: genre.slug,
      url: `/genre/${genre.slug}`,
    });
    genre.artists.forEach(indexArtist);
    genre.subgenres.forEach(indexSubgenre);
  }

  return entries;
}

// ─── Main ───────────────────────────────────────────────────────────────

function main() {
  console.log("Loading folder hierarchy...");
  const hierarchyPath = path.join(ROOT, "data", "folderHierarchy.json");
  const rawData = JSON.parse(fs.readFileSync(hierarchyPath, "utf-8")) as FolderNode;

  // The root key is "MP3"
  const mp3Root = rawData.MP3;
  if (!mp3Root) {
    console.error('Expected root key "MP3" in folderHierarchy.json');
    process.exit(1);
  }

  console.log("Parsing genres...");
  const genres: Genre[] = [];

  for (const [genreName, genreChildren] of Object.entries(mp3Root)) {
    if (IGNORED_GENRES.has(genreName)) {
      console.log(`  Skipping: ${genreName}`);
      continue;
    }

    console.log(`  Parsing: ${genreName}`);
    const result = walkHierarchy(genreChildren as FolderNode, [genreName], "genre");

    genres.push({
      name: genreName,
      slug: slugify(genreName),
      subgenres: result.subgenres,
      artists: result.artists,
      compilations: result.compilations,
    });
  }

  // Sort genres alphabetically
  genres.sort((a, b) => a.name.localeCompare(b.name));

  const stats = countStats(genres);
  const library: MusicLibrary = { genres, stats };

  // Write musicData.json
  const outputDir = path.join(ROOT, "data", "generated");
  fs.mkdirSync(outputDir, { recursive: true });

  const musicDataPath = path.join(outputDir, "musicData.json");
  fs.writeFileSync(musicDataPath, JSON.stringify(library, null, 2));
  console.log(`\nWrote ${musicDataPath}`);

  // Write search index (to data/generated and public/ for client-side access)
  console.log("Building search index...");
  const searchIndex = buildSearchIndex(genres);
  const searchIndexJson = JSON.stringify(searchIndex);

  const searchIndexPath = path.join(outputDir, "searchIndex.json");
  fs.writeFileSync(searchIndexPath, searchIndexJson);
  console.log(`Wrote ${searchIndexPath}`);

  const publicDir = path.join(ROOT, "public");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "searchIndex.json"), searchIndexJson);
  console.log(`Wrote public/searchIndex.json`);

  // Seed empty album art manifest if it doesn't exist (so Astro builds succeed before art processing)
  const manifestPath = path.join(outputDir, "albumArtManifest.json");
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ generatedAt: "", musicLibraryRoot: "", totalAlbums: 0, albumsWithArt: 0, albumsWithoutArt: 0, entries: {} }),
    );
    console.log("Created empty albumArtManifest.json (run 'pnpm art' to populate)");
  }

  // Print stats
  console.log("\n--- Library Stats ---");
  console.log(`Genres:       ${stats.totalGenres}`);
  console.log(`Subgenres:    ${stats.totalSubgenres}`);
  console.log(`Artists:      ${stats.totalArtists}`);
  console.log(`Albums:       ${stats.totalAlbums}`);
  console.log(`Compilations: ${stats.totalCompilations}`);
}

main();

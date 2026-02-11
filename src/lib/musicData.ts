import musicDataRaw from "../../data/generated/musicData.json";
import type { Artist, Genre, MusicLibrary, Subgenre } from "../../scripts/types";

const musicData = musicDataRaw as unknown as MusicLibrary;

export function getLibrary(): MusicLibrary {
  return musicData;
}

export function getGenres(): Genre[] {
  return musicData.genres;
}

export function getGenreBySlug(slug: string): Genre | undefined {
  return musicData.genres.find((g) => g.slug === slug);
}

/**
 * Find a subgenre by its slug path (e.g., ["metal", "black", "melodic"]).
 */
export function getSubgenreByPath(
  slugPath: string[],
): { genre: Genre; subgenre: Subgenre } | undefined {
  if (slugPath.length === 0) return undefined;

  const genre = getGenreBySlug(slugPath[0]);
  if (!genre) return undefined;

  if (slugPath.length === 1) return undefined; // it's a genre, not a subgenre

  let current: Subgenre | undefined;
  let subs = genre.subgenres;

  for (let i = 1; i < slugPath.length; i++) {
    current = subs.find((s) => s.slug === slugPath[i]);
    if (!current) return undefined;
    subs = current.subgenres;
  }

  return current ? { genre, subgenre: current } : undefined;
}

/**
 * Collect all artists from all genres/subgenres (flattened).
 */
export function getAllArtists(): Artist[] {
  const artists: Artist[] = [];

  function collectFromSubgenre(sg: Subgenre) {
    artists.push(...sg.artists);
    sg.subgenres.forEach(collectFromSubgenre);
  }

  for (const genre of musicData.genres) {
    artists.push(...genre.artists);
    genre.subgenres.forEach(collectFromSubgenre);
  }

  return artists;
}

/**
 * Find an artist by slug.
 */
export function getArtistBySlug(slug: string): Artist | undefined {
  return getAllArtists().find((a) => a.slug === slug);
}

/**
 * Count artists and albums in a node with artists[] and subgenres[] properties.
 */
function countTree(node: { artists: Artist[]; subgenres: Subgenre[] }): {
  artists: number;
  albums: number;
} {
  let artists = node.artists.length;
  let albums = node.artists.reduce((sum, a) => sum + a.albums.length, 0);

  function countSubgenre(sg: Subgenre) {
    artists += sg.artists.length;
    albums += sg.artists.reduce((sum, a) => sum + a.albums.length, 0);
    sg.subgenres.forEach(countSubgenre);
  }

  node.subgenres.forEach(countSubgenre);
  return { artists, albums };
}

/**
 * Count total artists and albums in a genre (including all subgenres).
 */
export function getGenreCounts(genre: Genre): { artists: number; albums: number } {
  return countTree(genre);
}

/**
 * Count total artists and albums in a subgenre (including nested subgenres).
 */
export function getSubgenreCounts(sg: Subgenre): { artists: number; albums: number } {
  return countTree(sg);
}

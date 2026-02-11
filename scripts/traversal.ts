import type { Artist, Compilation, MusicLibrary, Subgenre } from "./types.js";

/**
 * Walk all artists in the music library, deduplicating by slug.
 * Calls `visitor` for each unique artist across all genres/subgenres.
 */
export function forEachArtist(musicData: MusicLibrary, visitor: (artist: Artist) => void): void {
  const seen = new Set<string>();

  function visitArtist(artist: Artist) {
    if (seen.has(artist.slug)) return;
    seen.add(artist.slug);
    visitor(artist);
  }

  function fromSubgenre(sg: Subgenre) {
    sg.artists.forEach(visitArtist);
    sg.subgenres.forEach(fromSubgenre);
  }

  for (const genre of musicData.genres) {
    genre.artists.forEach(visitArtist);
    genre.subgenres.forEach(fromSubgenre);
  }
}

/**
 * Collect unique artists from the music library into an array.
 * The `mapper` transforms each Artist into the desired job shape.
 */
export function collectArtists<T>(
  musicData: MusicLibrary,
  mapper: (artist: Artist) => T | null,
): T[] {
  const results: T[] = [];
  forEachArtist(musicData, (artist) => {
    const result = mapper(artist);
    if (result !== null) results.push(result);
  });
  return results;
}

/**
 * Walk all artists and compilations, calling respective visitors.
 * Used by album art processing which needs both artists and VA compilations.
 */
export function forEachArtistAndCompilation(
  musicData: MusicLibrary,
  onArtist: (artist: Artist) => void,
  onCompilation: (compilation: Compilation) => void,
): void {
  function fromSubgenre(sg: Subgenre) {
    sg.artists.forEach(onArtist);
    sg.compilations.forEach(onCompilation);
    sg.subgenres.forEach(fromSubgenre);
  }

  for (const genre of musicData.genres) {
    genre.artists.forEach(onArtist);
    genre.compilations.forEach(onCompilation);
    genre.subgenres.forEach(fromSubgenre);
  }
}

/**
 * Count artists and albums under a subgenre tree (including nested subgenres).
 */
export function countSubgenreTree(sg: Subgenre): { artists: number; albums: number } {
  let artists = sg.artists.length;
  let albums = sg.artists.reduce((sum, a) => sum + a.albums.length, 0);

  function countNested(nested: Subgenre) {
    artists += nested.artists.length;
    albums += nested.artists.reduce((sum, a) => sum + a.albums.length, 0);
    nested.subgenres.forEach(countNested);
  }

  sg.subgenres.forEach(countNested);
  return { artists, albums };
}

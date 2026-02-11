/**
 * Load a JSON manifest from data/generated/ with a fallback default.
 * Used by albumArt.ts, spotify.ts, spotifyAlbums.ts.
 */
export async function loadManifest<T>(
  importFn: () => Promise<{ default: unknown }>,
  fallback: T,
): Promise<T> {
  try {
    const raw = await importFn();
    return raw.default as T;
  } catch {
    return fallback;
  }
}

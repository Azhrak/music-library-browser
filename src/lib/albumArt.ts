import type { ArtManifest } from "./albumArtTypes";

let manifest: ArtManifest = { entries: {} };
try {
  const raw = await import("../../data/generated/albumArtManifest.json");
  manifest = raw.default as unknown as ArtManifest;
} catch {
  // No manifest yet — all albums will show placeholder
}

export function getAlbumArtUrl(
  artistSlug: string,
  albumSlug: string,
): string | null {
  const artistEntries = manifest.entries?.[artistSlug];
  if (!artistEntries) return null;

  const entry = artistEntries[albumSlug];
  if (!entry) return null;

  return `/album-art/${artistSlug}/${albumSlug}.webp`;
}

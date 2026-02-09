import type { ArtManifest } from "./albumArtTypes";

let manifest: ArtManifest = { entries: {} };
try {
  const raw = await import("../../data/generated/albumArtManifest.json");
  manifest = raw.default as unknown as ArtManifest;
} catch {
  // No manifest yet — all albums will show placeholder
}

export function getAlbumArtUrls(
  artistSlug: string,
  albumSlug: string,
): { thumb: string; medium: string } | null {
  const artistEntries = manifest.entries?.[artistSlug];
  if (!artistEntries) return null;

  const entry = artistEntries[albumSlug];
  if (!entry) return null;

  return {
    thumb: `/album-art/${artistSlug}/${albumSlug}-thumb.webp`,
    medium: `/album-art/${artistSlug}/${albumSlug}-medium.webp`,
  };
}

import type { ArtManifest } from "./albumArtTypes";
import { loadManifest } from "./manifestLoader";

const manifest = await loadManifest<ArtManifest>(
  () => import("../../data/generated/albumArtManifest.json"),
  { entries: {} },
);

export function getAlbumArtUrl(artistSlug: string, albumSlug: string): string | null {
  const artistEntries = manifest.entries?.[artistSlug];
  if (!artistEntries) return null;

  const entry = artistEntries[albumSlug];
  if (!entry) return null;

  return `/album-art/${artistSlug}/${albumSlug}.webp`;
}

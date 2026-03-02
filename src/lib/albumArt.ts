import type { ArtManifest } from "./albumArtTypes";
import { loadManifest } from "./manifestLoader";
import { getSpotifyAlbumData } from "./spotifyAlbums";

const manifest = await loadManifest<ArtManifest>(
  () => import("../../data/generated/albumArtManifest.json"),
  { entries: {} },
);

export function getAlbumArtUrl(artistSlug: string, albumSlug: string): string | null {
  const entry = manifest.entries?.[artistSlug]?.[albumSlug];
  if (entry) {
    const base = import.meta.env.ALBUM_ART_BASE_URL ?? "";
    return `${base}/album-art/${artistSlug}/${albumSlug}.webp`;
  }

  // Fallback: use Spotify CDN image for albums with a Spotify match but no local art
  return getSpotifyAlbumData(artistSlug, albumSlug)?.imageUrl ?? null;
}

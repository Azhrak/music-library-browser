import { loadManifest } from "./manifestLoader";
import type { SpotifyAlbumEntry, SpotifyAlbumManifest } from "./spotifyTypes";

const manifest = await loadManifest<SpotifyAlbumManifest>(
  () => import("../../data/generated/spotifyAlbumManifest.json"),
  {
    generatedAt: "",
    totalArtistsQueried: 0,
    totalAlbumsMatched: 0,
    totalAlbumsUnmatched: 0,
    entries: {},
  },
);

export function getSpotifyAlbumData(
  artistSlug: string,
  albumSlug: string,
): SpotifyAlbumEntry | null {
  return manifest.entries?.[artistSlug]?.[albumSlug] ?? null;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

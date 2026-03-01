import { loadManifest } from "./manifestLoader";
import type { LastfmManifest } from "./lastfmTypes";

const manifest = await loadManifest<LastfmManifest>(
  () => import("../../data/generated/lastfmManifest.json"),
  { generatedAt: "", user: "", artists: {}, albums: {} },
);

export function getArtistPlaycount(artistSlug: string): number | null {
  return manifest.artists[artistSlug]?.playcount ?? null;
}

export function getAlbumPlaycount(artistSlug: string, albumSlug: string): number | null {
  return manifest.albums[artistSlug]?.[albumSlug]?.playcount ?? null;
}

export function getLastfmUser(): string {
  return manifest.user;
}

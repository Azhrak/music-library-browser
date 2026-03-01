import type { Genre, Subgenre } from "../../scripts/types";
import type { LastfmManifest } from "./lastfmTypes";
import { loadManifest } from "./manifestLoader";

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

export function getNodePlaycount(node: Genre | Subgenre): number {
  let total = 0;
  for (const a of node.artists) total += getArtistPlaycount(a.slug) ?? 0;
  for (const child of node.subgenres) total += getNodePlaycount(child);
  return total;
}

import { loadManifest } from "./manifestLoader";
import type { SpotifyArtistManifest } from "./spotifyTypes";

const manifest = await loadManifest<SpotifyArtistManifest>(
  () => import("../../data/generated/spotifyArtistManifest.json"),
  { generatedAt: "", totalQueried: 0, matched: 0, unmatched: 0, entries: {} },
);

export function getSpotifyArtistUrl(artistSlug: string): string | null {
  return manifest.entries?.[artistSlug]?.spotifyUrl ?? null;
}

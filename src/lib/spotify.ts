import type { SpotifyArtistManifest } from "./spotifyTypes";

let manifest: SpotifyArtistManifest = {
  generatedAt: "",
  totalQueried: 0,
  matched: 0,
  unmatched: 0,
  entries: {},
};

try {
  const raw = await import("../../data/generated/spotifyArtistManifest.json");
  manifest = raw.default as unknown as SpotifyArtistManifest;
} catch {
  // No manifest yet — all artists will use search URL fallback
}

export function getSpotifyArtistUrl(artistSlug: string): string | null {
  return manifest.entries?.[artistSlug]?.spotifyUrl ?? null;
}

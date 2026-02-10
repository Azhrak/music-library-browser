export interface SpotifyArtistEntry {
  artistSlug: string;
  spotifyUrl: string;
  spotifyId: string;
  fetchedAt: string;
}

export interface SpotifyArtistManifest {
  generatedAt: string;
  totalQueried: number;
  matched: number;
  unmatched: number;
  entries: Record<string, SpotifyArtistEntry>;
}

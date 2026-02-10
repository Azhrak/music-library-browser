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

// ─── Album / Track Types ─────────────────────────────────────────────

export interface SpotifyTrack {
  name: string;
  trackNumber: number;
  discNumber: number;
  durationMs: number;
  spotifyUrl: string;
}

export interface SpotifyAlbumEntry {
  albumSlug: string;
  artistSlug: string;
  spotifyAlbumId: string;
  spotifyAlbumUrl: string;
  name: string;
  releaseDate: string;
  totalTracks: number;
  imageUrl: string | null;
  tracks: SpotifyTrack[];
  fetchedAt: string;
}

export interface SpotifyAlbumManifest {
  generatedAt: string;
  totalArtistsQueried: number;
  totalAlbumsMatched: number;
  totalAlbumsUnmatched: number;
  entries: Record<string, Record<string, SpotifyAlbumEntry>>;
}

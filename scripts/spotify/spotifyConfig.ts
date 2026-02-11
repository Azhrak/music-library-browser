export const SPOTIFY_CONFIG = {
  // Spotify Web API
  API_BASE: "https://api.spotify.com/v1",
  TOKEN_URL: "https://accounts.spotify.com/api/token",

  // Manifest output (relative to project root)
  MANIFEST_PATH: "data/generated/spotifyArtistManifest.json",
  ALBUM_MANIFEST_PATH: "data/generated/spotifyAlbumManifest.json",

  // Concurrency and rate limiting
  CONCURRENCY: 5,
  DELAY_BETWEEN_BATCHES_MS: 200,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
};

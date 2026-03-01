export const LASTFM_CONFIG = {
  API_BASE: "https://ws.audioscrobbler.com/2.0",
  USER: "azhrak",
  MANIFEST_PATH: "data/generated/lastfmManifest.json",
  LIMIT: 200, // max per page
  DELAY_MS: 250, // ~4 req/sec, well within Last.fm's 5/sec limit
};

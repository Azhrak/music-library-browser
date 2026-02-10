export function buildAlbumSearchQuery(
  artistName: string,
  albumName: string,
  year: number | null,
): string {
  const parts = [artistName, albumName];
  if (year) parts.push(String(year));
  return parts.join(" ");
}

export function buildArtistSearchQuery(artistName: string): string {
  return artistName;
}

export function getYouTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function getSpotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

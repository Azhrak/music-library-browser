export interface LastfmArtistEntry {
  playcount: number;
}

export interface LastfmAlbumEntry {
  playcount: number;
}

export interface LastfmManifest {
  generatedAt: string;
  user: string;
  artists: Record<string, LastfmArtistEntry>;
  albums: Record<string, Record<string, LastfmAlbumEntry>>;
}

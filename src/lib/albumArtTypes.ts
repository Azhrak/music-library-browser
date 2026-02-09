export interface ArtManifestEntry {
  artistSlug: string;
  albumSlug: string;
  sourceFile: string;
}

export interface ArtManifest {
  entries: Record<string, Record<string, ArtManifestEntry>>;
}

export interface MusicLibrary {
  genres: Genre[];
  stats: LibraryStats;
}

export interface LibraryStats {
  totalGenres: number;
  totalSubgenres: number;
  totalArtists: number;
  totalAlbums: number;
  totalCompilations: number;
  generatedAt: string;
}

export interface Genre {
  name: string;
  slug: string;
  subgenres: Subgenre[];
  artists: Artist[];
  compilations: Compilation[];
}

export interface Subgenre {
  name: string;
  slug: string;
  fullPath: string[];
  subgenres: Subgenre[];
  artists: Artist[];
  compilations: Compilation[];
}

export interface Artist {
  name: string;
  slug: string;
  countryCode: string | null;
  country: string | null;
  isoCodes: string[];
  tags: string[];
  genrePath: string[];
  albums: Album[];
}

export interface Compilation {
  name: string;
  slug: string;
  genrePath: string[];
  albums: Album[];
}

export interface Album {
  name: string;
  slug: string;
  year: number | null;
  type: ReleaseType;
  reissue?: string;
  hasMultipleDiscs: boolean;
  discCount: number;
  rawFolderName: string;
}

export enum ReleaseType {
  Album = "album",
  EP = "ep",
  Single = "single",
  Compilation = "compilation",
  Split = "split",
  Demo = "demo",
  Live = "live",
  Other = "other",
}

export interface SearchEntry {
  type: "artist" | "album" | "genre";
  name: string;
  artist?: string;
  country?: string | null;
  isoCodes?: string[];
  year?: number | null;
  genrePath: string;
  slug: string;
  url: string;
  albumCount?: number;
}

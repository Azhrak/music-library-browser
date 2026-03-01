import { useState } from "react";
import CountryFlag from "./CountryFlag";

export interface ArtistRow {
  name: string;
  slug: string;
  country: string | null;
  isoCodes: string[];
  tags: string[];
  albumCount: number;
}

type SortKey = "name" | "country" | "plays";

interface Props {
  artists: ArtistRow[];
  playcounts: Record<string, number>;
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[var(--color-accent,#a78bfa)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function sortArtists(artists: ArtistRow[], key: SortKey, playcounts: Record<string, number>): ArtistRow[] {
  return [...artists].sort((a, b) => {
    if (key === "name") {
      return a.name.localeCompare(b.name);
    }
    if (key === "country") {
      const ca = a.country ?? "";
      const cb = b.country ?? "";
      if (!ca && !cb) return a.name.localeCompare(b.name);
      if (!ca) return 1;
      if (!cb) return -1;
      const cmp = ca.localeCompare(cb);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    }
    // plays — descending, no-data at end
    const pa = playcounts[a.slug] ?? -1;
    const pb = playcounts[b.slug] ?? -1;
    if (pa === pb) return a.name.localeCompare(b.name);
    return pb - pa;
  });
}

export default function ArtistList({ artists, playcounts }: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const hasPlaycounts = Object.keys(playcounts).length > 0;
  const sorted = sortArtists(artists, sort, playcounts);

  const btnBase =
    "rounded px-2.5 py-1 text-xs font-medium transition-colors";
  const btnActive =
    "bg-accent/20 text-accent-light";
  const btnInactive =
    "text-gray-500 hover:text-gray-300";

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-600">Sort:</span>
        {(["name", "country", "plays"] as SortKey[]).map((key) => {
          if (key === "plays" && !hasPlaycounts) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`${btnBase} ${sort === key ? btnActive : btnInactive}`}
            >
              {key === "name" ? "Name" : key === "country" ? "Country" : "Plays"}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {sorted.map((artist) => {
          const playcount = playcounts[artist.slug] ?? null;
          return (
            <a
              key={artist.slug}
              href={`/artist/${artist.slug}`}
              className="group flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#161616] px-4 py-3 transition-all hover:border-[var(--color-accent,#a78bfa)]/50 hover:bg-[#1e1e1e]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <MicIcon />
                <span className="font-medium text-gray-100 transition-colors group-hover:text-[var(--color-accent-light,#c4b5fd)]">
                  {artist.name}
                </span>
                {artist.tags.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({artist.tags.join(", ")})
                  </span>
                )}
                {artist.country && (
                  <span className="ml-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
                    <CountryFlag isoCodes={artist.isoCodes} country={artist.country} size={16} />
                    <span className="hidden sm:inline">{artist.country}</span>
                  </span>
                )}
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3 text-sm text-gray-500">
                {playcount !== null && (
                  <span className="flex items-center gap-1">
                    <HeadphonesIcon />
                    <span>{playcount.toLocaleString()}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <AlbumIcon />
                  <span>{artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}</span>
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

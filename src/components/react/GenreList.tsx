import { useState } from "react";

export interface GenreRow {
  name: string;
  href: string;
  artistCount: number;
  albumCount: number;
  subgenreCount?: number;
  plays: number;
}

type SortKey = "name" | "plays" | "artists" | "albums";

interface Props {
  genres: GenreRow[];
  hasPlaycounts: boolean;
  compact?: boolean;
}

function MusicIcon({ small }: { small?: boolean }) {
  const cls = small
    ? "mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent,#a78bfa)]"
    : "mt-0.5 h-6 w-6 shrink-0 text-[var(--color-accent,#a78bfa)]";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function Disc3Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12a6 6 0 0 1 6-6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
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

function sortGenres(genres: GenreRow[], key: SortKey): GenreRow[] {
  return [...genres].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "artists") {
      if (a.artistCount !== b.artistCount) return b.artistCount - a.artistCount;
      return a.name.localeCompare(b.name);
    }
    if (key === "albums") {
      if (a.albumCount !== b.albumCount) return b.albumCount - a.albumCount;
      return a.name.localeCompare(b.name);
    }
    // plays — descending, no-data at end
    if (a.plays !== b.plays) return b.plays - a.plays;
    return a.name.localeCompare(b.name);
  });
}

export default function GenreList({ genres, hasPlaycounts, compact = false }: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const sorted = sortGenres(genres, sort);

  const btnBase = "rounded px-2.5 py-1 text-xs font-medium transition-colors";
  const btnActive = "bg-accent/20 text-accent-light";
  const btnInactive = "text-gray-500 hover:text-gray-300";

  const sortKeys: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "artists", label: "Artists" },
    { key: "albums", label: "Albums" },
    ...(hasPlaycounts ? [{ key: "plays" as SortKey, label: "Plays" }] : []),
  ];

  const cardPadding = compact ? "p-4" : "p-5";
  const titleClass = compact
    ? "font-medium text-gray-100 transition-colors group-hover:text-[var(--color-accent-light,#c4b5fd)]"
    : "text-lg font-semibold text-gray-100 transition-colors group-hover:text-[var(--color-accent-light,#c4b5fd)]";
  const statsMargin = compact ? "mt-1" : "mt-2";

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        <span className="mr-1 text-xs text-gray-600">Sort:</span>
        {sortKeys.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`${btnBase} ${sort === key ? btnActive : btnInactive}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-${compact ? "3" : "4"} sm:grid-cols-2 lg:grid-cols-3`}>
        {sorted.map((genre) => (
          <a
            key={genre.href}
            href={genre.href}
            className={`group block rounded-lg border border-[#2a2a2a] bg-[#161616] ${cardPadding} transition-all hover:border-(--color-accent,#a78bfa)/50 hover:bg-[#1e1e1e]`}
          >
            <div className="flex items-start gap-2">
              <MusicIcon small={compact} />
              <div className="min-w-0">
                <div className={titleClass}>{genre.name}</div>
                <div className={`${statsMargin} flex flex-wrap gap-3 text-sm text-gray-400`}>
                  <span className="flex items-center gap-1">
                    <UsersIcon />
                    {genre.artistCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Disc3Icon />
                    {genre.albumCount}
                  </span>
                  {(genre.subgenreCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <LayersIcon />
                      {genre.subgenreCount}
                    </span>
                  )}
                  {genre.plays > 0 && (
                    <span className="flex items-center gap-1">
                      <HeadphonesIcon />
                      {genre.plays.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

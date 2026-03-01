import { Disc3, Headphones, Layers, Music, Users } from "lucide-react";
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
    ? "font-medium text-gray-100 transition-colors group-hover:text-(--color-accent-light,#c4b5fd)"
    : "text-lg font-semibold text-gray-100 transition-colors group-hover:text-(--color-accent-light,#c4b5fd)";
  const statsMargin = compact ? "mt-1" : "mt-2";
  const musicIconCls = compact
    ? "mt-0.5 h-5 w-5 shrink-0 text-(--color-accent,#a78bfa)"
    : "mt-0.5 h-6 w-6 shrink-0 text-(--color-accent,#a78bfa)";

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
              <Music className={musicIconCls} aria-hidden="true" />
              <div className="min-w-0">
                <div className={titleClass}>{genre.name}</div>
                <div className={`${statsMargin} flex flex-wrap gap-3 text-sm text-gray-400`}>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {genre.artistCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Disc3 className="h-4 w-4" aria-hidden="true" />
                    {genre.albumCount}
                  </span>
                  {(genre.subgenreCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Layers className="h-4 w-4" aria-hidden="true" />
                      {genre.subgenreCount}
                    </span>
                  )}
                  {genre.plays > 0 && (
                    <span className="flex items-center gap-1">
                      <Headphones className="h-4 w-4" aria-hidden="true" />
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

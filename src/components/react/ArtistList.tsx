import { DiscAlbum, Headphones, Mic } from "lucide-react";
import { useMemo, useState } from "react";
import CountryFlag from "./CountryFlag";
import CountryPicker from "./CountryPicker";
import YearPicker, { type YearSelection } from "./YearPicker";

export interface ArtistRow {
  name: string;
  slug: string;
  country: string | null;
  isoCodes: string[];
  tags: string[];
  albumCount: number;
  albumYears: number[];
}

type SortKey = "name" | "country" | "plays";

interface Props {
  artists: ArtistRow[];
  playcounts: Record<string, number>;
}

function sortArtists(
  artists: ArtistRow[],
  key: SortKey,
  playcounts: Record<string, number>,
): ArtistRow[] {
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

function filterArtists(
  artists: ArtistRow[],
  country: string | null,
  years: YearSelection,
): ArtistRow[] {
  return artists.filter((a) => {
    if (country !== null && a.country !== country) return false;
    if (years.type === "all") return true;
    if (a.albumYears.length === 0) return false;
    if (years.type === "year") return a.albumYears.includes(years.year);
    if (years.type === "decade")
      return a.albumYears.some((y) => Math.floor(y / 10) * 10 === years.decade);
    return a.albumYears.some((y) => y >= years.from && y <= years.to);
  });
}

export default function ArtistList({ artists, playcounts }: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<YearSelection>({ type: "all" });

  const hasPlaycounts = Object.keys(playcounts).length > 0;

  const countries = useMemo(() => {
    const map = new Map<string, { count: number; isoCodes: Set<string> }>();
    for (const a of artists) {
      if (a.country) {
        const existing = map.get(a.country);
        if (existing) {
          existing.count++;
          for (const iso of a.isoCodes) existing.isoCodes.add(iso);
        } else {
          map.set(a.country, { count: 1, isoCodes: new Set(a.isoCodes) });
        }
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, { count, isoCodes }]) => ({
        country,
        count,
        isoCodes: Array.from(isoCodes),
      }));
  }, [artists]);

  const allYears = useMemo(() => {
    const set = new Set<number>();
    for (const a of artists) for (const y of a.albumYears) set.add(y);
    return Array.from(set).sort();
  }, [artists]);

  const filtered = filterArtists(artists, countryFilter, yearFilter);
  const sorted = sortArtists(filtered, sort, playcounts);

  const activeFilters = (countryFilter !== null ? 1 : 0) + (yearFilter.type !== "all" ? 1 : 0);

  const btnBase = "rounded px-2.5 py-1 text-xs font-medium transition-colors";
  const btnActive = "bg-accent/20 text-accent-light";
  const btnInactive = "text-gray-500 hover:text-gray-300";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
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

        {(countries.length > 1 || allYears.length > 0) && (
          <>
            <span className="mx-1 text-gray-700">|</span>
            <span className="mr-1 text-xs text-gray-600">Filter:</span>

            {countries.length > 1 && (
              <CountryPicker
                countries={countries}
                value={countryFilter}
                onChange={setCountryFilter}
              />
            )}

            {allYears.length > 0 && (
              <YearPicker years={allYears} value={yearFilter} onChange={setYearFilter} />
            )}

            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCountryFilter(null);
                  setYearFilter({ type: "all" });
                }}
                className="ml-1 rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:text-gray-400"
                aria-label="Clear filters"
              >
                ✕ Clear
              </button>
            )}
          </>
        )}
      </div>

      {activeFilters > 0 && (
        <p className="mb-2 text-xs text-gray-600">
          Showing {sorted.length} of {artists.length} artists
        </p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {sorted.map((artist) => {
          const playcount = playcounts[artist.slug] ?? null;
          return (
            <a
              key={artist.slug}
              href={`/artist/${artist.slug}`}
              className="group flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#161616] px-4 py-3 transition-all hover:border-(--color-accent,#a78bfa)/50 hover:bg-[#1e1e1e]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Mic
                  className="h-5 w-5 shrink-0 text-(--color-accent,#a78bfa)"
                  aria-hidden="true"
                />
                <span className="font-medium text-gray-100 transition-colors group-hover:text-(--color-accent-light,#c4b5fd)">
                  {artist.name}
                </span>
                {artist.tags.length > 0 && (
                  <span className="ml-2 text-xs text-gray-500">({artist.tags.join(", ")})</span>
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
                    <Headphones className="h-4 w-4" aria-hidden="true" />
                    <span>{playcount.toLocaleString()}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <DiscAlbum className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}
                  </span>
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

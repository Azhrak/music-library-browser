import { useMemo, useState } from "react";
import type { YearSelection } from "../YearPicker";

export interface ArtistRow {
  name: string;
  slug: string;
  country: string | null;
  isoCodes: string[];
  tags: string[];
  albumCount: number;
  albumYears: number[];
}

export type SortKey = "name" | "country" | "plays";

export function useArtistFilters(artists: ArtistRow[], playcounts: Record<string, number>) {
  const [sort, setSort] = useState<SortKey>("name");
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<YearSelection>({ type: "all" });

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

  const activeFilters = (countryFilter !== null ? 1 : 0) + (yearFilter.type !== "all" ? 1 : 0);

  const filtered = sortArtists(filterArtists(artists, countryFilter, yearFilter), sort, playcounts);

  function clearFilters() {
    setCountryFilter(null);
    setYearFilter({ type: "all" });
  }

  return {
    sort,
    setSort,
    countryFilter,
    setCountryFilter,
    yearFilter,
    setYearFilter,
    countries,
    allYears,
    filtered,
    activeFilters,
    clearFilters,
    totalCount: artists.length,
  };
}

function sortArtists(
  artists: ArtistRow[],
  key: SortKey,
  playcounts: Record<string, number>,
): ArtistRow[] {
  return [...artists].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "country") {
      const ca = a.country ?? "";
      const cb = b.country ?? "";
      if (!ca && !cb) return a.name.localeCompare(b.name);
      if (!ca) return 1;
      if (!cb) return -1;
      const cmp = ca.localeCompare(cb);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    }
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

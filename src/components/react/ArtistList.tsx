import { ArtistListControls } from "./artist-list/ArtistListControls";
import { ArtistListItem } from "./artist-list/ArtistListItem";
import { type ArtistRow, useArtistFilters } from "./artist-list/useArtistFilters";

export type { ArtistRow } from "./artist-list/useArtistFilters";

interface Props {
  artists: ArtistRow[];
  playcounts: Record<string, number>;
}

export function ArtistList({ artists, playcounts }: Props) {
  const hasPlaycounts = Object.keys(playcounts).length > 0;
  const {
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
    totalCount,
  } = useArtistFilters(artists, playcounts);

  return (
    <div>
      <ArtistListControls
        sort={sort}
        onSort={setSort}
        hasPlaycounts={hasPlaycounts}
        countries={countries}
        countryFilter={countryFilter}
        onCountryChange={setCountryFilter}
        allYears={allYears}
        yearFilter={yearFilter}
        onYearChange={setYearFilter}
        activeFilters={activeFilters}
        onClearFilters={clearFilters}
      />

      {activeFilters > 0 && (
        <p className="mb-2 text-xs text-gray-600">
          Showing {filtered.length} of {totalCount} artists
        </p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((artist) => (
          <ArtistListItem
            key={artist.slug}
            artist={artist}
            playcount={playcounts[artist.slug] ?? null}
          />
        ))}
      </div>
    </div>
  );
}

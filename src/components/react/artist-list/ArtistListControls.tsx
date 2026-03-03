import { type CountryOption, CountryPicker } from "../CountryPicker";
import { YearPicker, type YearSelection } from "../YearPicker";
import type { SortKey } from "./useArtistFilters";

interface Props {
  sort: SortKey;
  onSort: (key: SortKey) => void;
  hasPlaycounts: boolean;
  countries: CountryOption[];
  countryFilter: string | null;
  onCountryChange: (v: string | null) => void;
  allYears: number[];
  yearFilter: YearSelection;
  onYearChange: (v: YearSelection) => void;
  activeFilters: number;
  onClearFilters: () => void;
}

const btnBase = "rounded px-2.5 py-1 text-xs font-medium transition-colors";
const btnActive = "bg-accent/20 text-accent-light";
const btnInactive = "text-gray-500 hover:text-gray-300";

export function ArtistListControls({
  sort,
  onSort,
  hasPlaycounts,
  countries,
  countryFilter,
  onCountryChange,
  allYears,
  yearFilter,
  onYearChange,
  activeFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-gray-600">Sort:</span>
      {(["name", "country", "plays"] as SortKey[]).map((key) => {
        if (key === "plays" && !hasPlaycounts) return null;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSort(key)}
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
            <CountryPicker countries={countries} value={countryFilter} onChange={onCountryChange} />
          )}

          {allYears.length > 0 && (
            <YearPicker years={allYears} value={yearFilter} onChange={onYearChange} />
          )}

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-1 rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:text-gray-400"
              aria-label="Clear filters"
            >
              ✕ Clear
            </button>
          )}
        </>
      )}
    </div>
  );
}

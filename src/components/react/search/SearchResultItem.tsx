import { CountryFlag } from "../CountryFlag";
import type { SearchEntry } from "./useSearch";

interface Props {
  result: SearchEntry;
  index: number;
  selectedIndex: number;
  onMouseEnter: (index: number) => void;
}

export function SearchResultItem({ result, index, selectedIndex, onMouseEnter }: Props) {
  return (
    <a
      href={result.url}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        index === selectedIndex ? "bg-surface-100" : "hover:bg-surface-50"
      }`}
      onMouseEnter={() => onMouseEnter(index)}
    >
      <span
        className={`shrink-0 text-xs font-medium ${typeColors[result.type] ?? "text-gray-500"}`}
      >
        {typeLabels[result.type] ?? result.type}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-200">
          {result.type === "artist" && result.isoCodes && result.isoCodes.length > 0 && (
            <CountryFlag isoCodes={result.isoCodes} country={result.country} size={14} />
          )}
          <span className="truncate">{result.name}</span>
        </div>
        <div className="truncate text-xs text-gray-500">
          {result.type === "album" && result.artist && (
            <span>
              {result.artist}
              {result.year && ` (${result.year})`}
              {" \u00B7 "}
            </span>
          )}
          {result.genrePath}
        </div>
      </div>
      {result.type === "artist" && result.albumCount && (
        <span className="ml-auto shrink-0 text-xs text-gray-600">{result.albumCount} albums</span>
      )}
    </a>
  );
}

const typeLabels: Record<string, string> = {
  artist: "Artist",
  album: "Album",
  genre: "Genre",
};

const typeColors: Record<string, string> = {
  artist: "text-indigo-400",
  album: "text-emerald-400",
  genre: "text-amber-400",
};

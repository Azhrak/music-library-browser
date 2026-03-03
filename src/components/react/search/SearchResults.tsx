import { SearchResultItem } from "./SearchResultItem";
import type { SearchEntry } from "./useSearch";

interface Props {
  results: SearchEntry[];
  selectedIndex: number;
  onMouseEnter: (index: number) => void;
  loading: boolean;
  query: string;
}

export function SearchResults({ results, selectedIndex, onMouseEnter, loading, query }: Props) {
  return (
    <div className="max-h-80 overflow-y-auto p-2">
      {loading && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">Loading search index...</div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      {!loading && query.length < 2 && (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          Type at least 2 characters to search
        </div>
      )}

      {results.map((result, index) => (
        <SearchResultItem
          key={`${result.type}-${result.slug}-${index}`}
          result={result}
          index={index}
          selectedIndex={selectedIndex}
          onMouseEnter={onMouseEnter}
        />
      ))}
    </div>
  );
}

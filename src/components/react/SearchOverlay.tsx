import { useEffect, useRef } from "react";
import { SearchInput } from "./search/SearchInput";
import { SearchResults } from "./search/SearchResults";
import { useSearch } from "./search/useSearch";

interface Props {
  onClose: () => void;
}

export function SearchOverlay({ onClose }: Props) {
  const { query, setQuery, results, selectedIndex, setSelectedIndex, loading, handleKeyDown } =
    useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[8vh] sm:pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="mx-3 w-full max-w-xl rounded-xl border border-[#333] bg-surface shadow-2xl sm:mx-0">
        <SearchInput
          value={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
        <SearchResults
          results={results}
          selectedIndex={selectedIndex}
          onMouseEnter={setSelectedIndex}
          loading={loading}
          query={query}
        />
      </div>
    </div>
  );
}

import Fuse from "fuse.js";
import { useCallback, useEffect, useRef, useState } from "react";
import CountryFlag from "./CountryFlag";

interface SearchEntry {
  type: "artist" | "album" | "genre";
  name: string;
  artist?: string;
  country?: string | null;
  isoCodes?: string[];
  year?: number | null;
  genrePath: string;
  slug: string;
  url: string;
  albumCount?: number;
}

interface Props {
  onClose: () => void;
}

export default function SearchOverlay({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const fuseRef = useRef<Fuse<SearchEntry> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search index
  useEffect(() => {
    fetch("/searchIndex.json")
      .then((r) => r.json())
      .then((data: SearchEntry[]) => {
        fuseRef.current = new Fuse(data, {
          keys: [
            { name: "name", weight: 2 },
            { name: "artist", weight: 1.5 },
            { name: "country", weight: 0.5 },
            { name: "genrePath", weight: 0.5 },
          ],
          threshold: 0.3,
          includeScore: true,
          minMatchCharLength: 2,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Search
  useEffect(() => {
    if (!fuseRef.current || query.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const searchResults = fuseRef.current.search(query, { limit: 30 }).map((r) => r.item);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        window.location.href = results[selectedIndex].url;
      }
    },
    [results, selectedIndex],
  );

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl border border-[#333] bg-[#0f0f0f] shadow-2xl">
        <div className="flex items-center border-b border-[#333] px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 shrink-0 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            role="img"
            aria-label="Search"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search artists, albums, genres..."
            className="w-full bg-transparent px-3 py-4 text-gray-100 outline-hidden placeholder:text-gray-600"
          />
          <kbd className="shrink-0 rounded bg-[#252525] px-2 py-1 text-xs text-gray-500">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Loading search index...
            </div>
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
            <a
              key={`${result.type}-${result.slug}-${index}`}
              href={result.url}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                index === selectedIndex ? "bg-[#252525]" : "hover:bg-[#1a1a1a]"
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
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
                <span className="ml-auto shrink-0 text-xs text-gray-600">
                  {result.albumCount} albums
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

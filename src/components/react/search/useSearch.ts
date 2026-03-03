import Fuse from "fuse.js";
import { useCallback, useEffect, useRef, useState } from "react";

export interface SearchEntry {
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

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const fuseRef = useRef<Fuse<SearchEntry> | null>(null);

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

  return { query, setQuery, results, selectedIndex, setSelectedIndex, loading, handleKeyDown };
}

import { useEffect, useState } from "react";
import SearchOverlay from "./SearchOverlay";

export default function SearchTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-[#555] hover:text-gray-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
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
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded bg-[#252525] px-1.5 py-0.5 text-xs text-gray-500 sm:inline">
          Ctrl+K
        </kbd>
      </button>
      {isOpen && <SearchOverlay onClose={() => setIsOpen(false)} />}
    </>
  );
}

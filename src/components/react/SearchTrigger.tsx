import { useEffect, useState } from "react";
import { SearchIcon } from "./icons/SearchIcon";
import { SearchOverlay } from "./SearchOverlay";

export function SearchTrigger() {
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
        className="flex items-center gap-2 rounded-md border border-[#333] bg-surface-50 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:border-[#555] hover:text-gray-300"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded bg-surface-100 px-1.5 py-0.5 text-xs text-gray-500 sm:inline">
          Ctrl+K
        </kbd>
      </button>
      {isOpen && <SearchOverlay onClose={() => setIsOpen(false)} />}
    </>
  );
}

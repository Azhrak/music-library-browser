import { SearchIcon } from "../icons/SearchIcon";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function SearchInput({ value, onChange, onKeyDown, inputRef }: Props) {
  return (
    <div className="flex items-center border-b border-[#333] px-4">
      <SearchIcon className="h-5 w-5 shrink-0 text-gray-500" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search artists, albums, genres..."
        className="w-full bg-transparent px-3 py-4 text-gray-100 outline-hidden placeholder:text-gray-600"
      />
      <kbd className="shrink-0 rounded bg-surface-100 px-2 py-1 text-xs text-gray-500">Esc</kbd>
    </div>
  );
}

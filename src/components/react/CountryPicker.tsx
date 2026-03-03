import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { CountryFlag } from "./CountryFlag";
import { useClickOutside } from "./useClickOutside";

export interface CountryOption {
  country: string;
  count: number;
  isoCodes: string[];
}

interface Props {
  countries: CountryOption[];
  value: string | null;
  onChange: (v: string | null) => void;
}

export function CountryPicker({ countries, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false), open);

  const selected = value ? countries.find((c) => c.country === value) : null;
  const active = value !== null;
  const btnBase = "rounded px-2.5 py-1 text-xs font-medium transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${btnBase} flex items-center gap-1.5 ${
          active ? "bg-accent/20 text-accent-light" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        {selected ? (
          <div className="min-w-3.5 min-h-3.5 flex items-center gap-1">
            <CountryFlag isoCodes={selected.isoCodes} country={selected.country} size={14} />
            <span>{selected.country}</span>
          </div>
        ) : (
          <span>Country</span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-[#2a2a2a] bg-[#0e0e0e] py-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-[#222] hover:text-gray-300"
          >
            All countries
          </button>
          {countries.map(({ country, count, isoCodes }) => (
            <button
              key={country}
              type="button"
              onClick={() => {
                onChange(country);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#222] ${
                value === country ? "text-accent-light" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <div className="min-w-3.5 min-h-3.5 flex items-center">
                <CountryFlag isoCodes={isoCodes} country={country} size={14} />
              </div>
              <span>{country}</span>
              <span className="ml-auto pl-4 text-gray-600">({count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

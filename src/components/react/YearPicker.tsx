import { CalendarDays, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useClickOutside } from "./useClickOutside";

export type YearSelection =
  | { type: "all" }
  | { type: "decade"; decade: number }
  | { type: "year"; year: number }
  | { type: "range"; from: number; to: number };

interface Props {
  years: number[];
  value: YearSelection;
  onChange: (v: YearSelection) => void;
}

export function YearPicker({ years, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(
    ref,
    () => {
      setOpen(false);
      setPendingFrom(null);
    },
    open,
  );

  const yearSet = useMemo(() => new Set(years), [years]);
  const decades = useMemo(
    () => Array.from(new Set(years.map((y) => Math.floor(y / 10) * 10))).sort((a, b) => b - a),
    [years],
  );

  function isHighlighted(y: number): boolean {
    if (pendingFrom !== null) {
      const lo = Math.min(pendingFrom, hovered ?? pendingFrom);
      const hi = Math.max(pendingFrom, hovered ?? pendingFrom);
      return y >= lo && y <= hi;
    }
    if (value.type === "all") return false;
    if (value.type === "decade") return Math.floor(y / 10) * 10 === value.decade;
    if (value.type === "year") return y === value.year;
    return y >= value.from && y <= value.to;
  }

  function handleDecade(decade: number) {
    onChange({ type: "decade", decade });
    setOpen(false);
    setPendingFrom(null);
  }

  function handleYear(y: number) {
    if (pendingFrom === null) {
      setPendingFrom(y);
    } else if (pendingFrom === y) {
      onChange({ type: "year", year: y });
      setOpen(false);
      setPendingFrom(null);
    } else {
      onChange({
        type: "range",
        from: Math.min(pendingFrom, y),
        to: Math.max(pendingFrom, y),
      });
      setOpen(false);
      setPendingFrom(null);
    }
  }

  const active = value.type !== "all";
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
        <CalendarDays className="h-3.5 w-3.5" />
        {selectionLabel(value)}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-[#2a2a2a] bg-[#0e0e0e] p-3 shadow-xl">
          {pendingFrom !== null && (
            <p className="mb-2 text-xs text-gray-500">
              From <span className="text-accent-light">{pendingFrom}</span> — click end year
            </p>
          )}
          <table className="border-separate border-spacing-0.5 text-xs">
            <tbody>
              {decades.map((decade) => {
                const cols = Array.from({ length: 10 }, (_, i) => decade + i);
                return (
                  <tr key={decade}>
                    <td className="pr-1">
                      <button
                        type="button"
                        onClick={() => handleDecade(decade)}
                        className="whitespace-nowrap rounded px-2 py-1 font-medium text-gray-400 transition-colors hover:bg-accent/20 hover:text-accent-light"
                      >
                        {decade}s
                      </button>
                    </td>
                    {cols.map((y) => {
                      const exists = yearSet.has(y);
                      const hi = exists && isHighlighted(y);
                      return (
                        <td key={y}>
                          {exists ? (
                            <button
                              type="button"
                              onClick={() => handleYear(y)}
                              onMouseEnter={() => pendingFrom !== null && setHovered(y)}
                              onMouseLeave={() => setHovered(null)}
                              className={`w-7 rounded py-1 text-center transition-colors ${
                                hi
                                  ? "bg-accent/30 text-accent-light"
                                  : "text-gray-400 hover:bg-[#222] hover:text-gray-200"
                              }${y === pendingFrom ? " ring-1 ring-accent/60" : ""}`}
                            >
                              {String(y).slice(-2)}
                            </button>
                          ) : (
                            <span className="block w-7" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function selectionLabel(v: YearSelection): string {
  if (v.type === "all") return "All years";
  if (v.type === "decade") return `${v.decade}s`;
  if (v.type === "year") return String(v.year);
  return `${v.from}–${v.to}`;
}

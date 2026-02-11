export const typeColors: Record<string, string> = {
  album: "bg-accent/20 text-accent-light",
  ep: "bg-emerald-500/20 text-emerald-400",
  single: "bg-amber-500/20 text-amber-400",
  demo: "bg-orange-500/20 text-orange-400",
  live: "bg-rose-500/20 text-rose-400",
  compilation: "bg-cyan-500/20 text-cyan-400",
  split: "bg-violet-500/20 text-violet-400",
  other: "bg-gray-500/20 text-gray-400",
};

export function getTypeColor(type: string): string {
  return typeColors[type] ?? typeColors.other;
}

export const typeLabels: Record<string, string> = {
  album: "Albums",
  ep: "EPs",
  single: "Singles",
  demo: "Demos",
  live: "Live",
  compilation: "Compilations",
  split: "Splits",
  other: "Other",
};

/** Ordered list of album types for rendering sections on artist page */
export const albumTypeSections = [
  "album",
  "ep",
  "single",
  "demo",
  "live",
  "compilation",
  "split",
  "other",
] as const;

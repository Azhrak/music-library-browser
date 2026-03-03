import {
  Album as AlbumIcon,
  Archive,
  Disc3,
  GitBranch,
  Mic,
  Music,
  Package,
  PenTool,
} from "@lucide/astro";

// biome-ignore lint/suspicious/noExplicitAny: Astro component type not publicly exported; required for JSX rendering
export const typeIcons: Record<string, any> = {
  album: AlbumIcon,
  ep: Disc3,
  single: Music,
  demo: PenTool,
  live: Mic,
  compilation: Archive,
  split: GitBranch,
  other: Package,
};

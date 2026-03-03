import { DiscAlbum, Headphones, Mic } from "lucide-react";
import { CountryFlag } from "../CountryFlag";
import type { ArtistRow } from "./useArtistFilters";

interface Props {
  artist: ArtistRow;
  playcount: number | null;
}

export function ArtistListItem({ artist, playcount }: Props) {
  return (
    <a
      href={`/artist/${artist.slug}`}
      className="group flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#161616] px-4 py-3 transition-all hover:border-(--color-accent,#a78bfa)/50 hover:bg-[#1e1e1e]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Mic className="h-5 w-5 shrink-0 text-(--color-accent,#a78bfa)" aria-hidden="true" />
        <span className="font-medium text-gray-100 transition-colors group-hover:text-(--color-accent-light,#c4b5fd)">
          {artist.name}
        </span>
        {artist.tags.length > 0 && (
          <span className="ml-2 text-xs text-gray-500">({artist.tags.join(", ")})</span>
        )}
        {artist.country && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
            <CountryFlag isoCodes={artist.isoCodes} country={artist.country} size={16} />
            <span className="hidden sm:inline">{artist.country}</span>
          </span>
        )}
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-3 text-sm text-gray-500">
        {playcount !== null && (
          <span className="flex items-center gap-1">
            <Headphones className="h-4 w-4" aria-hidden="true" />
            <span>{playcount.toLocaleString()}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <DiscAlbum className="h-4 w-4" aria-hidden="true" />
          <span>
            {artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}
          </span>
        </span>
      </div>
    </a>
  );
}

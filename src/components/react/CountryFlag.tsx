const FLAG_BASE_URL = "https://hatscripts.github.io/circle-flags/flags";

interface CountryFlagProps {
  isoCodes: string[];
  country?: string | null;
  size?: number;
}

export default function CountryFlag({ isoCodes, country, size = 16 }: CountryFlagProps) {
  if (isoCodes.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {isoCodes.map((iso) => (
        <img
          key={iso}
          src={`${FLAG_BASE_URL}/${iso}.svg`}
          alt={country ?? iso.toUpperCase()}
          width={size}
          height={size}
          className="inline-block shrink-0 rounded-full"
          loading="lazy"
          decoding="async"
        />
      ))}
    </span>
  );
}

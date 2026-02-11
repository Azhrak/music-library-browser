/**
 * Maps the custom country codes found in the music library folder names
 * to full country names. These are mostly non-standard abbreviations.
 */
export const COUNTRY_CODE_MAP: Record<string, string> = {
  // Two-letter codes
  NL: "Netherlands",
  NZ: "New Zealand",
  UK: "United Kingdom",
  US: "United States",
  Ro: "Romania",

  // Three-letter codes (alphabetical)
  And: "Andorra",
  Arg: "Argentina",
  Aus: "Australia",
  Aut: "Austria",
  Bel: "Belgium",
  Blr: "Belarus",
  Bra: "Brazil",
  Bul: "Bulgaria",
  Can: "Canada",
  Chi: "Chile",
  Col: "Colombia",
  Cze: "Czechia",
  Den: "Denmark",
  Egy: "Egypt",
  Esp: "Spain",
  Est: "Estonia",
  Fin: "Finland",
  Fra: "France",
  Fro: "Faroe Islands",
  Geo: "Georgia",
  Ger: "Germany",
  Gre: "Greece",
  Gui: "Guatemala",
  Hun: "Hungary",
  Ice: "Iceland",
  Ind: "India",
  Ire: "Ireland",
  Isl: "Iceland",
  Isr: "Israel",
  Ita: "Italy",
  Jam: "Jamaica",
  Jap: "Japan",
  Jor: "Jordan",
  Kgz: "Kyrgyzstan",
  Kor: "South Korea",
  Lat: "Latvia",
  Leb: "Lebanon",
  Lit: "Lithuania",
  Mal: "Malaysia",
  Mex: "Mexico",
  Mlt: "Malta",
  Nor: "Norway",
  Per: "Peru",
  Phi: "Philippines",
  Pol: "Poland",
  Por: "Portugal",
  Prt: "Portugal",
  Rom: "Romania",
  Rus: "Russia",
  Ser: "Serbia",
  Slo: "Slovenia",
  Slv: "Slovenia",
  Sui: "Switzerland",
  Svk: "Slovakia",
  Swe: "Sweden",
  Tha: "Thailand",
  Tun: "Tunisia",
  Tur: "Turkey",
  Twn: "Taiwan",
  Ukr: "Ukraine",
  USA: "United States",
  Ven: "Venezuela",
};

/**
 * Known non-country-code values that appear in parentheses in folder names.
 * Used to avoid false positive artist detection.
 */
export const FALSE_POSITIVE_CODES = new Set([
  // Media/format tags
  "EP",
  "CDS",
  "CDM",
  "DVD",
  "2CD",
  "CD1",
  "CD2",
  "CD3",
  "CD4",
  "CD5",
  "CD6",
  "CD7",
  "CD8",
  "CD9",
  // Quality/format
  "Lossless",
  "Lossles",
  // Release type
  "Live",
  "Demo",
  "Promo",
  "Split",
  "Compilation",
  "Remix",
  "Remixes",
  "Remaster",
  "Remastered",
  "Re-Mastered",
  "Bootleg",
  "Tribute",
  "Unreleased",
  "Vinyl",
  "Discography",
  // Genre tags that appear in parens on albums
  "Acoustic",
  "Orchestral",
  "Instrumental",
  "Trance",
  "Techno",
  "House",
  "Chill",
  "Dance",
  "Dancecore",
  "Rock",
  "RnB",
  "Chant",
  "Flash",
  "V-Rock",
  "Wildstyle",
  // Rating
  "PG",
  "PG13",
  // Audio format
  "m4a",
  "ogg",
  // Misc false positives
  "Flo",
  "Ins",
  "Not",
  "N",
  "ID",
  "Feat",
  "Miss",
  "Reloaded",
  "Trackfix",
  "Spain",
]);

/**
 * Known artist tags that appear after the country code in parentheses.
 * e.g., "Underoath (US) (later)" → tags: ["later"]
 */
export const ARTIST_TAGS = new Set([
  "early",
  "middle",
  "later",
  "acoustic",
  "instrumental",
  "female vocals",
]);

/**
 * Maps custom country codes to ISO 3166-1 alpha-2 codes (lowercase)
 * for use with circle-flags CDN.
 */
export const CUSTOM_TO_ISO: Record<string, string> = {
  // Two-letter codes
  NL: "nl",
  NZ: "nz",
  UK: "gb",
  US: "us",
  Ro: "ro",

  // Three-letter codes (alphabetical)
  And: "ad",
  Arg: "ar",
  Aus: "au",
  Aut: "at",
  Bel: "be",
  Blr: "by",
  Bra: "br",
  Bul: "bg",
  Can: "ca",
  Chi: "cl",
  Col: "co",
  Cze: "cz",
  Den: "dk",
  Egy: "eg",
  Esp: "es",
  Est: "ee",
  Fin: "fi",
  Fra: "fr",
  Fro: "fo",
  Geo: "ge",
  Ger: "de",
  Gre: "gr",
  Gui: "gt",
  Hun: "hu",
  Ice: "is",
  Ind: "in",
  Ire: "ie",
  Isl: "is",
  Isr: "il",
  Ita: "it",
  Jam: "jm",
  Jap: "jp",
  Jor: "jo",
  Kgz: "kg",
  Kor: "kr",
  Lat: "lv",
  Leb: "lb",
  Lit: "lt",
  Mal: "my",
  Mex: "mx",
  Mlt: "mt",
  Nor: "no",
  Per: "pe",
  Phi: "ph",
  Pol: "pl",
  Por: "pt",
  Prt: "pt",
  Rom: "ro",
  Rus: "ru",
  Ser: "rs",
  Slo: "si",
  Slv: "si",
  Sui: "ch",
  Svk: "sk",
  Swe: "se",
  Tha: "th",
  Tun: "tn",
  Tur: "tr",
  Twn: "tw",
  Ukr: "ua",
  USA: "us",
  Ven: "ve",
};

export function resolveIsoCode(customCode: string): string | null {
  if (CUSTOM_TO_ISO[customCode]) return CUSTOM_TO_ISO[customCode];

  const normalized = customCode.charAt(0).toUpperCase() + customCode.slice(1).toLowerCase();
  if (CUSTOM_TO_ISO[normalized]) return CUSTOM_TO_ISO[normalized];

  const upper = customCode.toUpperCase();
  if (CUSTOM_TO_ISO[upper]) return CUSTOM_TO_ISO[upper];

  return null;
}

/**
 * Resolve a (possibly multi-country) custom code to an array of ISO codes.
 * "Aut-UK" -> ["at", "gb"], "Ger" -> ["de"], null -> []
 */
export function resolveIsoCodes(customCode: string | null): string[] {
  if (!customCode) return [];
  const parts = customCode.split(/[-&]/);
  return parts.map((p) => resolveIsoCode(p.trim())).filter((code): code is string => code !== null);
}

export function resolveCountry(code: string | null): string | null {
  if (!code) return null;

  // Direct lookup (case-sensitive first since most codes match directly)
  if (COUNTRY_CODE_MAP[code]) return COUNTRY_CODE_MAP[code];

  // Try case-insensitive by capitalizing first letter
  const normalized = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  if (COUNTRY_CODE_MAP[normalized]) return COUNTRY_CODE_MAP[normalized];

  // Try uppercase (for 2-letter codes like "us" → "US")
  const upper = code.toUpperCase();
  if (COUNTRY_CODE_MAP[upper]) return COUNTRY_CODE_MAP[upper];

  return null;
}

/**
 * Checks if a parenthetical value is a known country code.
 */
export function isCountryCode(value: string): boolean {
  if (FALSE_POSITIVE_CODES.has(value)) return false;
  return resolveCountry(value) !== null;
}

/**
 * Resolve a multi-country code like "Aut-UK" or "Isr&UK" to full names.
 */
export function resolveMultiCountry(code: string): string | null {
  const parts = code.split(/[-&]/);
  const resolved = parts.map((p) => resolveCountry(p.trim())).filter(Boolean);
  return resolved.length > 0 ? resolved.join(" / ") : null;
}

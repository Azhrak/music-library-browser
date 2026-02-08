/**
 * Convert a string to a URL-safe slug.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Generate a unique slug by appending a suffix if needed.
 */
export function uniqueSlug(text: string, existing: Set<string>, suffix?: string): string {
  let slug = slugify(suffix ? `${text}-${suffix}` : text);
  if (!existing.has(slug)) {
    existing.add(slug);
    return slug;
  }
  let i = 2;
  while (existing.has(`${slug}-${i}`)) i++;
  slug = `${slug}-${i}`;
  existing.add(slug);
  return slug;
}

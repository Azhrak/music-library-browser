# Social Meta Tags & SEO Basics

## Context

The site had no meta description, OpenGraph tags, Twitter Card tags, favicon, or robots.txt.
This means link previews in iMessage, Discord, Slack, and social media show bare URLs with no title, image, or description.

Search engine crawling is explicitly **not wanted** — this is a personal library, not a public index.

## What We're Adding

### `Layout.astro` — new props + `<head>` additions

New optional props:
- `description` — shown in meta description, OG, and Twitter. Each page supplies its own; Layout has no default (pages always pass one).
- `ogImage` — absolute or root-relative URL for the preview image. Defaults to the site logo.

Tags added in `<head>`:
- `<meta name="description">` — search/preview snippet
- `<link rel="canonical">` — built from `Astro.url.href`
- Favicon: `<link rel="icon">` (64×64 PNG) + `<link rel="apple-touch-icon">` (full logo)
- OpenGraph: `og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:site_name`
- Twitter Card: `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`, `twitter:image`

OG image resolution: if `ogImage` starts with `http` it's used as-is; otherwise it's prepended with `Astro.site.origin`. This handles the R2 album art URL (already absolute in prod) and the logo path (`/images/...`, made absolute).

### Per-page descriptions

| Page | Description |
|------|-------------|
| `index.astro` | "A personal music library browser — {N} artists and {N} albums across {N} genres." |
| `genre/[...path].astro` | "{Genre} — {N} artists in the Music Library." (or "{N} subgenres" if no direct artists) |
| `artist/[slug].astro` | "{Artist} ({Country}) — {N} releases. {Genre path} on Music Library." |
| `artist/[artistSlug]/[albumSlug].astro` | "{Album} by {Artist} ({Year}). {Genre path} on Music Library." + album art as `ogImage` |

### `public/robots.txt`

```
User-agent: *
Disallow: /
```

No sitemap link — the site should not be indexed at all.

## Files Modified

- `src/components/astro/Layout.astro` — meta tags, favicon
- `src/pages/index.astro` — description prop
- `src/pages/genre/[...path].astro` — description prop
- `src/pages/artist/[slug].astro` — description prop
- `src/pages/artist/[artistSlug]/[albumSlug].astro` — description + ogImage props
- `public/robots.txt` — new file

## Verification

1. `pnpm build` — should complete without errors
2. Inspect generated HTML for any album page: verify `<meta property="og:image">` contains the R2 URL
3. Use [opengraph.xyz](https://www.opengraph.xyz) or Discord paste-a-link to confirm preview renders with logo image
4. Verify `https://music-library.azhrak.dev/robots.txt` returns `Disallow: /` after deploy

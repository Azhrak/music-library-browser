# Feature Roadmap — Missing Basic Web Features

Audit of standard web features not yet present in the site, organized by priority.
The site is a personal music library browser at https://music-library.azhrak.dev — **not intended for public indexing**.

---

## Priority 1 — Social & SEO Basics

These are missing from every page and have immediate visible impact when sharing links.

### 1.1 Social meta tags
**Status:** planned (see [social-meta-tags.md](social-meta-tags.md))

Every page needs these in `<head>`:

```html
<!-- Description -->
<meta name="description" content="..." />
<link rel="canonical" href="https://music-library.azhrak.dev/..." />

<!-- OpenGraph (iMessage, Discord, Slack, Facebook, LinkedIn) -->
<meta property="og:type" content="website" />
<meta property="og:url" content="..." />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="https://..." />
<meta property="og:site_name" content="Music Library" />

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="https://..." />
```

**Implementation:** extend `Layout.astro` with `description: string` and `ogImage?: string | null` props.
OG image: album art from R2 on album pages; site logo everywhere else.
Make relative paths absolute via `Astro.site.origin`.

Per-page descriptions:
| Page | Description pattern |
|------|---------------------|
| Homepage | "A personal music library browser — {N} artists and {N} albums across {N} genres." |
| Genre/subgenre | "{Name} — {N} artists in the Music Library." / "{N} subgenres" if no direct artists |
| Artist | "{Name} ({Country}) — {N} releases. {Genre path} on Music Library." |
| Album | "{Album} by {Artist} ({Year}). {Genre path} on Music Library." + album art as og:image |

**Files to touch:**
- `src/components/astro/Layout.astro`
- `src/pages/index.astro`
- `src/pages/genre/[...path].astro`
- `src/pages/artist/[slug].astro`
- `src/pages/artist/[artistSlug]/[albumSlug].astro`

### 1.2 Favicon & touch icons
**Status:** planned

Logo images exist at `public/images/`:
- `music-library-browser-logo-64x64.png` — browser tab icon
- `music-library-browser-logo.png` — apple-touch-icon (home screen)

Add to `Layout.astro` `<head>`:
```html
<link rel="icon" href="/images/music-library-browser-logo-64x64.png" type="image/png" />
<link rel="apple-touch-icon" href="/images/music-library-browser-logo.png" />
```

### 1.3 robots.txt — block all crawling
**Status:** done (`public/robots.txt` exists)

```
User-agent: *
Disallow: /
```

No sitemap link since the site is intentionally not indexed.

---

## Priority 2 — Structure & User Experience

### 2.1 Custom 404 page
**Status:** not started

Astro serves a default 404 when a route isn't found. A custom page improves UX and keeps the site's visual style.

Create `src/pages/404.astro`:
- Uses `Layout.astro`
- "Page not found" heading
- Link back to homepage
- Cloudflare Pages picks up `404.html` automatically from static output

### 2.2 JSON-LD structured data
**Status:** not started

Structured data gives search engines (and tools like Google Rich Results) machine-readable info about the content.
Since the site blocks crawlers this is lower value, but good practice if crawling policy changes.

Schema types to use:
- Homepage: `WebSite` with `SearchAction` (points to search)
- Artist page: `MusicGroup` (name, genre, url)
- Album page: `MusicAlbum` (name, byArtist, datePublished, numTracks, genre)

Add as `<script type="application/ld+json">` inside `<head>` or via a dedicated `JsonLd.astro` component.

### 2.3 PWA manifest (`site.webmanifest`)
**Status:** not started

Enables "Add to Home Screen" on mobile and sets the browser chrome color.

Create `public/site.webmanifest`:
```json
{
  "name": "Music Library",
  "short_name": "Music Library",
  "description": "Personal music library browser",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/images/music-library-browser-logo-64x64.png", "sizes": "64x64", "type": "image/png" },
    { "src": "/images/music-library-browser-logo.png", "sizes": "any", "type": "image/png" }
  ]
}
```

Add to `Layout.astro`:
```html
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#6366f1" />
```

---

## Priority 3 — Analytics

### 3.1 Privacy-friendly analytics
**Status:** not started

Options (no Google Analytics — too invasive for a personal tool):
- **Plausible** — simple, privacy-first, $9/mo hosted or self-host
- **Cloudflare Web Analytics** — free, already using Cloudflare Pages, zero config
- **Umami** — self-hosted, free

Recommended: **Cloudflare Web Analytics** since the site is already on Cloudflare Pages.
Add the Cloudflare beacon script tag to `Layout.astro`.

---

## Priority 4 — Accessibility

### 4.1 Skip-to-content link
**Status:** not started

Standard accessibility requirement for keyboard users and screen readers.

Add at the very top of `<body>` in `Layout.astro`, before `<Header>`:
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute ...">
  Skip to main content
</a>
```
Add `id="main-content"` to the `<main>` element.

---

## Priority 5 — Nice to Have

### 5.1 RSS feed
**Status:** not started / low value

Would require deciding what to feed (new artists? albums by year?). The data is static and rarely changes.
Use `@astrojs/rss` if desired. Not a priority.

### 5.2 Light mode toggle
**Status:** not started

Dark mode is hardcoded via `class="dark"` on `<html>`. A toggle would require:
- Storing preference in `localStorage`
- Toggling `class="dark"` on `<html>` via a small inline script (to avoid flash)
- CSS variables already scoped to `.dark` in `src/styles/global.css`

### 5.3 Share / copy link button
**Status:** not started

A "Copy link" button on artist and album pages using `navigator.clipboard.writeText(window.location.href)`.
URLs are already shareable by design (all content is SSG with stable routes).

---

## Excluded Features

| Feature | Reason |
|---------|--------|
| `sitemap.xml` | Site blocks all crawlers; no value |
| Service worker / offline | Static CDN already fast; complexity not worth it |
| Pagination | Lists are manageable size; no need |
| Error boundary | Graceful fallbacks already in place |

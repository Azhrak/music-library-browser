import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import type { Artist, Genre, MusicLibrary, Subgenre } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");

// ─── Configuration ──────────────────────────────────────────────────────

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: "320px", width: 320, height: 568 }, // iPhone SE
  { name: "375px", width: 375, height: 667 }, // iPhone 12/13/14
  { name: "414px", width: 414, height: 896 }, // iPhone Plus
  { name: "768px", width: 768, height: 1024 }, // iPad portrait
];

interface PageConfig {
  name: string;
  path: string;
  fullPage: boolean;
}

const DEFAULT_PORT = 4321;

// ─── Dynamic page discovery ─────────────────────────────────────────────

interface SubgenreMatch {
  subgenre: Subgenre;
  slugPath: string; // e.g. "electroacoustic/ambient-slow"
}

function discoverPages(): PageConfig[] {
  const dataPath = path.join(ROOT, "data/generated/musicData.json");
  if (!fs.existsSync(dataPath)) {
    console.error("musicData.json not found. Run 'pnpm build' first.");
    process.exit(1);
  }

  const musicData: MusicLibrary = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const pages: PageConfig[] = [];

  // Homepage
  pages.push({ name: "homepage", path: "/", fullPage: true });

  // Pick a genre with subgenres and artists
  const genre = musicData.genres.find((g) => g.subgenres.length > 0) ?? musicData.genres[0];
  if (genre) {
    pages.push({ name: "genre", path: `/genre/${genre.slug}`, fullPage: true });

    // Pick a subgenre that has artists — build slug path by walking the tree
    const match = findSubgenreWithArtists(genre);
    if (match) {
      pages.push({ name: "subgenre", path: `/genre/${match.slugPath}`, fullPage: true });

      // Pick an artist with multiple albums from this subgenre
      const artist =
        [...match.subgenre.artists].sort((a, b) => b.albums.length - a.albums.length)[0] ?? null;
      if (artist) {
        pages.push({ name: "artist", path: `/artist/${artist.slug}`, fullPage: true });

        // Pick an album
        if (artist.albums.length > 0) {
          pages.push({
            name: "album",
            path: `/artist/${artist.slug}/${artist.albums[0].slug}`,
            fullPage: true,
          });
        }
      }
    }
  }

  return pages;
}

function findSubgenreWithArtists(genre: Genre): SubgenreMatch | null {
  for (const sg of genre.subgenres) {
    const slugPath = `${genre.slug}/${sg.slug}`;
    if (sg.artists.length >= 3) return { subgenre: sg, slugPath };
    const nested = findNestedSubgenreWithArtists(sg, slugPath);
    if (nested) return nested;
  }
  if (genre.subgenres[0]) {
    return { subgenre: genre.subgenres[0], slugPath: `${genre.slug}/${genre.subgenres[0].slug}` };
  }
  return null;
}

function findNestedSubgenreWithArtists(
  sg: Subgenre,
  parentSlugPath: string,
): SubgenreMatch | null {
  for (const child of sg.subgenres) {
    const slugPath = `${parentSlugPath}/${child.slug}`;
    if (child.artists.length >= 3) return { subgenre: child, slugPath };
    const nested = findNestedSubgenreWithArtists(child, slugPath);
    if (nested) return nested;
  }
  return null;
}

// ─── Server management ──────────────────────────────────────────────────

function parseArgs(): { baseUrl: string; managedServer: boolean } {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  if (urlArg) {
    return { baseUrl: urlArg.split("=")[1], managedServer: false };
  }
  return { baseUrl: `http://localhost:${DEFAULT_PORT}`, managedServer: true };
}

async function startPreviewServer(): Promise<ChildProcess> {
  console.log("Starting preview server...");
  const server = spawn("npx", ["astro", "preview", "--port", String(DEFAULT_PORT)], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
  });

  server.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString();
    if (msg.includes("ERROR") || msg.includes("Error")) {
      console.error("Server error:", msg);
    }
  });

  await waitForServer(`http://localhost:${DEFAULT_PORT}`, 15_000);
  console.log(`Preview server ready on port ${DEFAULT_PORT}`);
  return server;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

function stopServer(server: ChildProcess): void {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process may already be dead
    }
  } else {
    server.kill("SIGTERM");
  }
}

// ─── Screenshot capture ─────────────────────────────────────────────────

async function captureSearchOverlay(
  page: Page,
  baseUrl: string,
  dir: string,
): Promise<void> {
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  // Click the search trigger button
  await page.click("button:has(svg)");

  // Wait for dialog to appear
  try {
    await page.waitForSelector("[role=\"dialog\"]", { timeout: 5000 });
  } catch {
    console.warn("    Search overlay did not appear, skipping");
    return;
  }

  // Small delay for render
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(dir, "search-empty.png"),
    fullPage: false,
  });

  // Type a query
  const input = page.locator("[role=\"dialog\"] input");
  await input.fill("metal");
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(dir, "search-results.png"),
    fullPage: false,
  });

  await page.keyboard.press("Escape");
}

async function captureAllScreenshots(baseUrl: string, pages: PageConfig[]): Promise<void> {
  // Clean output directory
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    fs.rmSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  try {
    for (const viewport of VIEWPORTS) {
      const viewportDir = path.join(SCREENSHOTS_DIR, viewport.name);
      fs.mkdirSync(viewportDir, { recursive: true });

      console.log(
        `\n── Viewport: ${viewport.name} (${viewport.width}x${viewport.height}) ──`,
      );

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });

      const page = await context.newPage();

      for (const pageConfig of pages) {
        const url = `${baseUrl}${pageConfig.path}`;
        console.log(`  ${pageConfig.name} → ${pageConfig.path}`);

        await page.goto(url, { waitUntil: "networkidle" });
        await page.screenshot({
          path: path.join(viewportDir, `${pageConfig.name}.png`),
          fullPage: pageConfig.fullPage,
        });
      }

      // Search overlay
      console.log("  search-empty + search-results");
      await captureSearchOverlay(page, baseUrl, viewportDir);

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { baseUrl, managedServer } = parseArgs();
  const pages = discoverPages();
  let server: ChildProcess | null = null;

  console.log("Discovered pages:");
  for (const p of pages) {
    console.log(`  ${p.name}: ${p.path}`);
  }

  try {
    if (managedServer) {
      server = await startPreviewServer();
    }

    console.log(`\nCapturing screenshots from ${baseUrl}`);
    console.log(`Viewports: ${VIEWPORTS.map((v) => v.name).join(", ")}`);
    console.log(`Pages: ${pages.length} + search overlay (2 states)\n`);

    await captureAllScreenshots(baseUrl, pages);

    const totalScreenshots = VIEWPORTS.length * (pages.length + 2);
    console.log(`\nDone! ${totalScreenshots} screenshots saved to screenshots/`);
    console.log("Directory structure:");
    for (const viewport of VIEWPORTS) {
      console.log(`  screenshots/${viewport.name}/`);
    }
  } finally {
    if (server) {
      stopServer(server);
    }
  }
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});

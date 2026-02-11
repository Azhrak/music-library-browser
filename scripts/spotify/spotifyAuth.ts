import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPOTIFY_CONFIG } from "./spotifyConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

// ─── Environment ────────────────────────────────────────────────────────

export function loadEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }

  return undefined;
}

// ─── Spotify Auth ───────────────────────────────────────────────────────

let accessToken = "";
let tokenExpiresAt = 0;

export async function authenticate(): Promise<void> {
  const clientId = loadEnvVar("SPOTIFY_CLIENT_ID");
  const clientSecret = loadEnvVar("SPOTIFY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error(
      "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env or as environment variables.",
    );
    console.error("Get credentials at https://developer.spotify.com/dashboard");
    process.exit(1);
  }

  const response = await fetch(SPOTIFY_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Spotify auth failed (${response.status}): ${text}`);
    process.exit(1);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  // Refresh 60s before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  console.log("Spotify authentication successful.\n");
}

export async function ensureAuth(): Promise<void> {
  if (Date.now() >= tokenExpiresAt) {
    console.log("Refreshing Spotify token...");
    await authenticate();
  }
}

export function getAccessToken(): string {
  return accessToken;
}

// ─── Utilities ──────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function spotifyGet<T>(url: string): Promise<T | null> {
  await ensureAuth();

  for (let attempt = 0; attempt < SPOTIFY_CONFIG.MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "5", 10);
      console.warn(`  Rate limited. Waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!response.ok) {
      console.warn(`  Spotify request failed (${response.status}): ${url}`);
      return null;
    }

    return (await response.json()) as T;
  }

  return null;
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvVar } from "./spotify/spotifyAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ART_DIR = path.join(ROOT, "public/album-art");

const BUCKET = "music-library-browser";
const CONCURRENCY = 10;

// ─── R2 client ──────────────────────────────────────────────────────────

function createR2Client(): S3Client {
  const accessKeyId = loadEnvVar("R2_ACCESS_KEY_ID");
  const secretAccessKey = loadEnvVar("R2_SECRET_ACCESS_KEY");
  const endpoint = loadEnvVar("R2_ENDPOINT");

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    console.error(
      "Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT in .env",
    );
    process.exit(1);
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// ─── File discovery ─────────────────────────────────────────────────────

interface UploadJob {
  localPath: string;
  r2Key: string;
}

function collectJobs(): UploadJob[] {
  if (!fs.existsSync(ART_DIR)) {
    console.error(`Album art directory not found: ${ART_DIR}`);
    console.error("Run 'pnpm art' first to generate album art.");
    process.exit(1);
  }

  const jobs: UploadJob[] = [];
  const artists = fs.readdirSync(ART_DIR);

  for (const artist of artists) {
    const artistDir = path.join(ART_DIR, artist);
    if (!fs.statSync(artistDir).isDirectory()) continue;

    for (const file of fs.readdirSync(artistDir)) {
      if (!file.endsWith(".webp")) continue;
      jobs.push({
        localPath: path.join(artistDir, file),
        r2Key: `album-art/${artist}/${file}`,
      });
    }
  }

  return jobs;
}

// ─── Upload ─────────────────────────────────────────────────────────────

async function uploadJob(client: S3Client, job: UploadJob): Promise<void> {
  const body = fs.readFileSync(job.localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: job.r2Key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

async function uploadAll(client: S3Client, jobs: UploadJob[]): Promise<void> {
  let done = 0;
  let failed = 0;
  const total = jobs.length;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        try {
          await uploadJob(client, job);
          done++;
          if (done % 100 === 0 || done === total) {
            process.stdout.write(`\r  ${done}/${total} uploaded${failed ? ` (${failed} failed)` : ""}   `);
          }
        } catch (err) {
          failed++;
          console.error(`\n  Failed: ${job.r2Key} — ${(err as Error).message}`);
        }
      }),
    );
  }

  process.stdout.write("\n");
  if (failed) {
    console.error(`\nUpload complete with ${failed} failures.`);
    process.exit(1);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const jobs = collectJobs();
  console.log(`Found ${jobs.length} album art files in ${ART_DIR}`);
  console.log(`Uploading to r2://${BUCKET}/album-art/ ...`);

  const client = createR2Client();
  await uploadAll(client, jobs);

  console.log(`Done. Files accessible at:`);
  console.log(`  https://images.mlb.azhrak.dev/album-art/`);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});

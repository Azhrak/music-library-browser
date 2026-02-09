export const ART_CONFIG = {
  // Image file names to search for, in priority order (case-insensitive)
  PRIORITY_FILENAMES: ["cover", "front", "folder"],

  // Supported image extensions (case-insensitive)
  SUPPORTED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp"],

  // Output size (single image per album, CSS controls display size)
  IMAGE_SIZE: 500,

  // Quality settings (WebP)
  WEBP_QUALITY: 80,

  // Output directory (relative to project root)
  OUTPUT_DIR: "public/album-art",

  // Manifest file path (relative to project root)
  MANIFEST_PATH: "data/generated/albumArtManifest.json",

  // Max source image dimension to process (skip corrupt/enormous files)
  MAX_SOURCE_DIMENSION: 10000,

  // Concurrency for parallel processing
  CONCURRENCY: 8,
};

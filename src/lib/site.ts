/** Central site identity used by metadata, sitemap and robots. */
export const SITE_NAME = "PureDownload";

/**
 * Canonical production origin. Override with NEXT_PUBLIC_SITE_URL when the
 * domain changes (e.g. a custom domain later on). No trailing slash.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pure-downloader.vercel.app"
).replace(/\/+$/, "");

export const SITE_TAGLINE = "Video Downloader, Zero Added Watermarks";

export const SITE_DESCRIPTION =
  "Fast, privacy-focused video downloader. Paste a link, pick a quality, and save videos or MP3s locally. We never add a watermark to your downloaded files.";

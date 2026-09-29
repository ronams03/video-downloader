// PureDownload engine — server-side download pipeline simulation.
//
// The sandbox cannot fetch media from real video platforms, so this engine
// implements a realistic, time-based download pipeline: URL analysis, quality
// selection, queueing with concurrency limits, lazy progress computation
// (speed / ETA / bytes), deterministic mid-download failures, pause / resume /
// cancel / retry, and finalization into real playable files in the library.

import { db } from "@/lib/db";
import type {
  AnalyzedVideo,
  AppSettings,
  DownloadJobDTO,
  DownloadRequestItem,
  FileDTO,
  FormatOption,
  JobStatus,
  MediaKind,
  StorageInfo,
} from "@/lib/types";

export const TOTAL_STORAGE_BYTES = 64 * 1024 * 1024 * 1024; // 64 GB simulated device storage
export const MAX_BATCH_FREE = 5;
export const MAX_BATCH_PREMIUM = 20;

const THUMB_COUNT = 5;

export class EngineError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Deterministic hashing (FNV-1a) — same URL always analyzes to same metadata.
// ---------------------------------------------------------------------------

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(arr: T[], hash: number): T {
  return arr[hash % arr.length];
}

// ---------------------------------------------------------------------------
// Single-flight lock so concurrent polling cannot double-finalize jobs.
// ---------------------------------------------------------------------------

let lockPromise: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockPromise.then(fn, fn);
  lockPromise = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// URL analysis
// ---------------------------------------------------------------------------

interface PlatformDef {
  match: RegExp;
  name: string;
}

const PLATFORMS: PlatformDef[] = [
  { match: /(^|\.)(youtube\.com|youtu\.be)$/, name: "YouTube" },
  { match: /(^|\.)tiktok\.com$/, name: "TikTok" },
  { match: /(^|\.)(twitter\.com|x\.com)$/, name: "X" },
  { match: /(^|\.)instagram\.com$/, name: "Instagram" },
  { match: /(^|\.)vimeo\.com$/, name: "Vimeo" },
  { match: /(^|\.)(facebook\.com|fb\.watch)$/, name: "Facebook" },
  { match: /(^|\.)reddit\.com$/, name: "Reddit" },
  { match: /(^|\.)twitch\.tv$/, name: "Twitch" },
  { match: /(^|\.)soundcloud\.com$/, name: "SoundCloud" },
  { match: /(^|\.)dailymotion\.com$/, name: "Dailymotion" },
];

const TITLE_A = [
  "Golden Hour", "City Lights", "Ocean Dreams", "Morning Run", "Coffee Ritual",
  "Mountain Air", "Neon Nights", "Sunset Drive", "Quiet Mornings", "Street Food Tour",
  "Weekend Escape", "Deep Focus", "Wanderlust", "First Snow", "Summer Breeze",
  "Night Market", "Skyline Walk", "Forest Trail", "Rooftop Session", "Slow Living",
];

const TITLE_B = [
  "— 4K Timelapse", "| Cinematic Vlog", "— Official Video", "| Ambient Mix",
  "— Highlights", "| Behind the Scenes", "| Live Session", "— Short Film",
  "— Full Episode", "| Field Notes",
];

const AUTHORS = [
  "Aria Films", "Nomad Studio", "Pixel Trails", "Wanderful", "The Daily Frame",
  "Loop Studio", "Northlight Media", "Amber Light Films", "Drift Collective", "Frame & Field",
];

// Bitrate table for size estimation: [quality, megabits per second]
const VIDEO_BITRATES: Array<[string, number, string]> = [
  ["1080p", 4.8, "1080p · Full HD"],
  ["720p", 2.6, "720p · HD"],
  ["480p", 1.2, "480p · SD"],
  ["360p", 0.75, "360p"],
  ["240p", 0.35, "240p"],
  ["144p", 0.12, "144p · Data saver"],
];

const AUDIO_BITRATES: Array<[string, string]> = [
  ["320 kbps", "MP3 · 320 kbps · Best"],
  ["192 kbps", "MP3 · 192 kbps"],
  ["128 kbps", "MP3 · 128 kbps · Compact"],
];

export function detectPlatform(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const fileMatch = /\.(mp4|webm|mov|mkv|mp3|m4a|wav|ogg)$/i.exec(parsed.pathname);
    if (fileMatch) return "Direct file";
    const platform = PLATFORMS.find((p) => p.match.test(host));
    return platform ? platform.name : "Web video";
  } catch {
    return "Web video";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function analyzeUrl(rawUrl: string): AnalyzedVideo {
  const url = rawUrl.trim();
  if (!isValidUrl(url)) {
    throw new EngineError("invalid_url", "Please paste a valid http(s) video link.", 400);
  }
  const hash = fnv1a(url);
  const durationSec = 38 + (hash % 563); // 38s – 10min
  const thumbKey = String(1 + (hash % THUMB_COUNT));

  const formats: FormatOption[] = VIDEO_BITRATES.map(([quality, mbps, label]) => ({
    kind: "video" as MediaKind,
    quality,
    label,
    format: "mp4",
    sizeBytes: Math.round(durationSec * mbps * 125000),
  }));
  for (const [quality, label] of AUDIO_BITRATES) {
    const kbps = parseInt(quality, 10);
    formats.push({
      kind: "audio",
      quality,
      label,
      format: "mp3",
      sizeBytes: Math.round((durationSec * kbps * 1000) / 8),
    });
  }

  return {
    url,
    title: `${pick(TITLE_A, hash)} ${pick(TITLE_B, hash >>> 5)}`,
    author: pick(AUTHORS, hash >>> 11),
    platform: detectPlatform(url),
    durationSec,
    thumbnail: `/thumbs/thumb-${thumbKey}.jpg`,
    thumbKey,
    formats,
  };
}

export function findFormat(analyzed: AnalyzedVideo, kind: MediaKind, quality: string): FormatOption {
  const found = analyzed.formats.find((f) => f.kind === kind && f.quality === quality);
  if (found) return found;
  // Graceful fallback: default quality for the requested kind.
  const fallback = analyzed.formats.find((f) => f.kind === kind);
  if (fallback) return fallback;
  throw new EngineError("no_format", "No matching format found for this video.", 400);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = { concurrency: 2, premium: false, autoOrganize: true };

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const concurrency = parseInt(map.get("concurrency") ?? "", 10);
  return {
    concurrency: Number.isFinite(concurrency) ? Math.min(4, Math.max(1, concurrency)) : DEFAULT_SETTINGS.concurrency,
    premium: map.get("premium") === "true",
    autoOrganize: map.get("autoOrganize") !== "false",
  };
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const entries: Array<[string, string]> = [];
  if (partial.concurrency !== undefined) {
    const max = partial.premium ? 4 : 2;
    entries.push(["concurrency", String(Math.min(max, Math.max(1, Math.round(partial.concurrency))))]);
  }
  if (partial.premium !== undefined) entries.push(["premium", String(partial.premium)]);
  if (partial.autoOrganize !== undefined) entries.push(["autoOrganize", String(partial.autoOrganize)]);
  for (const [key, value] of entries) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  return getSettings();
}

// ---------------------------------------------------------------------------
// Progress computation (lazy, time-based)
// ---------------------------------------------------------------------------

function activeMs(job: { accumulatedMs: number; startedAt: Date | null }, now: number): number {
  const running = job.startedAt ? Math.max(0, now - job.startedAt.getTime()) : 0;
  return job.accumulatedMs + running;
}

export function downloadedBytesOf(
  job: { totalBytes: number; speedBps: number; accumulatedMs: number; startedAt: Date | null },
  now: number,
): number {
  return Math.min(job.totalBytes, Math.round((job.speedBps * activeMs(job, now)) / 1000));
}

export function toJobDTO(
  job: {
    id: string; url: string; title: string; author: string; platform: string; kind: string;
    quality: string; format: string; totalBytes: number; speedBps: number; status: string;
    errorMessage: string | null; thumbKey: string; createdAt: Date; completedAt: Date | null;
    fileId: string | null; accumulatedMs: number; startedAt: Date | null;
  },
  now: number,
): DownloadJobDTO {
  const bytes = downloadedBytesOf(job, now);
  const progress = job.totalBytes > 0 ? Math.min(100, (bytes / job.totalBytes) * 100) : 0;
  const etaSeconds =
    job.status === "downloading" && job.speedBps > 0
      ? Math.max(0, (job.totalBytes - bytes) / job.speedBps)
      : null;
  return {
    id: job.id,
    url: job.url,
    title: job.title,
    author: job.author,
    platform: job.platform,
    kind: job.kind as MediaKind,
    quality: job.quality,
    format: job.format,
    totalBytes: job.totalBytes,
    downloadedBytes: bytes,
    progress: Math.round(progress * 10) / 10,
    speedBps: job.speedBps,
    etaSeconds: etaSeconds != null ? Math.round(etaSeconds) : null,
    status: job.status as JobStatus,
    errorMessage: job.errorMessage,
    thumbKey: job.thumbKey,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    fileId: job.fileId,
  };
}

// ---------------------------------------------------------------------------
// File naming / sample mapping
// ---------------------------------------------------------------------------

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function samplePathFor(kind: string, seed: string): string {
  if (kind === "audio") return "sample-audio-1";
  return fnv1a(seed) % 2 === 0 ? "sample-video-1" : "sample-video-2";
}

export function toFileDTO(
  file: {
    id: string; name: string; kind: string; quality: string; format: string; sizeBytes: number;
    durationSec: number; sourceUrl: string; thumbKey: string; hue: number; favorite: boolean;
    folderId: string | null; folderName: string | null; createdAt: Date;
  },
): FileDTO {
  return {
    id: file.id,
    name: file.name,
    kind: file.kind as MediaKind,
    quality: file.quality,
    format: file.format,
    sizeBytes: file.sizeBytes,
    durationSec: file.durationSec,
    sourceUrl: file.sourceUrl,
    thumbKey: file.thumbKey,
    hue: file.hue,
    favorite: file.favorite,
    folderId: file.folderId,
    folderName: file.folderName,
    createdAt: file.createdAt.toISOString(),
    streamUrl: `/api/files/${file.id}/stream`,
  };
}

async function ensureAutoFolder(name: string): Promise<string> {
  const existing = await db.folder.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await db.folder.create({ data: { name } });
  return created.id;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function storageInfo(): Promise<StorageInfo> {
  const [agg, fileCount, activeCount, historyCount] = await Promise.all([
    db.mediaFile.aggregate({ _sum: { sizeBytes: true } }),
    db.mediaFile.count(),
    db.downloadJob.count({ where: { status: { in: ["queued", "downloading", "paused"] } } }),
    db.downloadJob.count({ where: { status: { in: ["completed", "failed", "canceled"] } } }),
  ]);
  return {
    usedBytes: agg._sum.sizeBytes ?? 0,
    totalBytes: TOTAL_STORAGE_BYTES,
    fileCount,
    activeCount,
    historyCount,
  };
}

async function freeBytesEstimate(): Promise<number> {
  const [used, activeJobs] = await Promise.all([
    db.mediaFile.aggregate({ _sum: { sizeBytes: true } }),
    db.downloadJob.findMany({
      where: { status: { in: ["queued", "downloading", "paused"] } },
      select: { totalBytes: true, speedBps: true, accumulatedMs: true, startedAt: true },
    }),
  ]);
  const now = Date.now();
  const reserved = activeJobs.reduce(
    (sum, j) => sum + Math.max(0, j.totalBytes - downloadedBytesOf(j, now)),
    0,
  );
  return TOTAL_STORAGE_BYTES - (used._sum.sizeBytes ?? 0) - reserved;
}

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------

export async function createJobs(items: DownloadRequestItem[]): Promise<DownloadJobDTO[]> {
  if (items.length === 0) {
    throw new EngineError("empty_batch", "No download items provided.", 400);
  }
  const settings = await getSettings();
  const maxBatch = settings.premium ? MAX_BATCH_PREMIUM : MAX_BATCH_FREE;
  if (items.length > maxBatch) {
    throw new EngineError(
      "batch_limit",
      `Free plan allows up to ${MAX_BATCH_FREE} links per batch. Go Premium for ${MAX_BATCH_PREMIUM}.`,
      402,
    );
  }

  const analyzed = items.map((item) => {
    if (!isValidUrl(item.url)) {
      throw new EngineError("invalid_url", `"${item.url.slice(0, 60)}" is not a valid video link.`, 400);
    }
    const a = analyzeUrl(item.url);
    return { item, analyzed: a, format: findFormat(a, item.kind, item.quality) };
  });

  // Smart storage management: warn/block when a download cannot fit.
  const needed = analyzed.reduce((sum, a) => sum + a.format.sizeBytes, 0);
  const free = await freeBytesEstimate();
  if (needed > free) {
    throw new EngineError(
      "insufficient_storage",
      `Not enough storage for this download (${Math.round(needed / 1048576)} MB needed, ${Math.round(
        free / 1048576,
      )} MB free). Free up space or pick a lower quality.`,
      409,
    );
  }

  const now = new Date();
  const jobs = [];
  for (const { item, analyzed: a, format } of analyzed) {
    const failHash = fnv1a(item.url + "#fail");
    const failAtBytes =
      item.kind === "video" && failHash % 100 < 12
        ? Math.round((format.sizeBytes * (30 + (failHash % 40))) / 100)
        : null;
    const speedBps = 1_200_000 + (fnv1a(item.url + "#speed") % 45) * 100_000; // 1.2 – 5.6 MB/s
    const job = await db.downloadJob.create({
      data: {
        url: a.url,
        title: a.title,
        author: a.author,
        platform: a.platform,
        kind: item.kind,
        quality: format.quality,
        format: format.format,
        totalBytes: format.sizeBytes,
        speedBps,
        failAtBytes,
        status: "queued",
        thumbKey: a.thumbKey,
      },
    });
    jobs.push(job);
  }
  await syncJobs(now.getTime());
  const dtos = await activeJobs();
  const createdIds = new Set(jobs.map((j) => j.id));
  return dtos.filter((j) => createdIds.has(j.id));
}

// ---------------------------------------------------------------------------
// Sync: advance progress, fail, finalize, promote queued jobs.
// Returns titles of jobs that completed during this sync (for toasts).
// ---------------------------------------------------------------------------

export interface SyncEvents {
  completed: string[];
  failed: Array<{ title: string; message: string }>;
}

export async function syncJobs(nowMs?: number): Promise<SyncEvents> {
  const now = nowMs ?? Date.now();
  return withLock(async () => {
    const completed: string[] = [];
    const failed: Array<{ title: string; message: string }> = [];
    const downloading = await db.downloadJob.findMany({ where: { status: "downloading" } });

    for (const job of downloading) {
      const bytes = downloadedBytesOf(job, now);
      if (job.failAtBytes != null && bytes >= job.failAtBytes && bytes < job.totalBytes) {
        await db.downloadJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage: "Connection lost while downloading. Retry to resume where it stopped.",
            accumulatedMs: Math.round((job.failAtBytes / job.speedBps) * 1000),
            startedAt: null,
          },
        });
        failed.push({ title: job.title, message: "Connection lost while downloading. Tap retry to resume." });
        continue;
      }
      if (bytes >= job.totalBytes) {
        const autoFolder =
          (await getSettings()).autoOrganize
            ? await ensureAutoFolder(job.kind === "audio" ? "Audio" : "Videos")
            : null;
        const file = await db.mediaFile.create({
          data: {
            jobId: job.id,
            name: sanitizeName(`${job.title}.${job.format}`),
            kind: job.kind,
            quality: job.quality,
            format: job.format,
            sizeBytes: job.totalBytes,
            durationSec: 0, // patched below with analyzed duration
            sourceUrl: job.url,
            filePath: samplePathFor(job.kind, job.id),
            thumbKey: job.thumbKey,
            hue: fnv1a(job.id) % 360,
            folderId: autoFolder,
          },
        });
        const analyzed = analyzeUrl(job.url);
        await db.mediaFile.update({ where: { id: file.id }, data: { durationSec: analyzed.durationSec } });
        await db.downloadJob.update({
          where: { id: job.id },
          data: { status: "completed", completedAt: new Date(now), fileId: file.id, startedAt: null, accumulatedMs: job.totalBytes > 0 ? Math.round((job.totalBytes / job.speedBps) * 1000) : 0 },
        });
        completed.push(job.title);
      }
    }

    const activeCount = await db.downloadJob.count({ where: { status: "downloading" } });
    const settings = await getSettings();
    if (activeCount < settings.concurrency) {
      const queued = await db.downloadJob.findMany({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
        take: settings.concurrency - activeCount,
      });
      for (const job of queued) {
        await db.downloadJob.update({
          where: { id: job.id },
          data: { status: "downloading", startedAt: new Date(now) },
        });
      }
    }
    return { completed, failed };
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function activeJobs(): Promise<DownloadJobDTO[]> {
  const now = Date.now();
  const jobs = await db.downloadJob.findMany({
    where: { status: { in: ["queued", "downloading", "paused"] } },
    orderBy: { createdAt: "asc" },
  });
  return jobs.map((j) => toJobDTO(j, now));
}

export async function historyJobs(): Promise<DownloadJobDTO[]> {
  const now = Date.now();
  const jobs = await db.downloadJob.findMany({
    where: { status: { in: ["completed", "failed", "canceled"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jobs.map((j) => toJobDTO(j, now));
}

export async function jobDTOById(id: string): Promise<DownloadJobDTO | null> {
  const job = await db.downloadJob.findUnique({ where: { id } });
  return job ? toJobDTO(job, Date.now()) : null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function pauseJob(id: string): Promise<void> {
  return withLock(async () => {
    const job = await db.downloadJob.findUnique({ where: { id } });
    if (!job || job.status !== "downloading") return;
    const now = Date.now();
    const extra = job.startedAt ? Math.max(0, now - job.startedAt.getTime()) : 0;
    await db.downloadJob.update({
      where: { id },
      data: { status: "paused", accumulatedMs: job.accumulatedMs + extra, startedAt: null },
    });
  });
}

export async function resumeJob(id: string): Promise<void> {
  return withLock(async () => {
    const job = await db.downloadJob.findUnique({ where: { id } });
    if (!job || job.status !== "paused") return;
    await db.downloadJob.update({ where: { id }, data: { status: "queued" } });
  });
}

export async function cancelJob(id: string): Promise<void> {
  return withLock(async () => {
    const job = await db.downloadJob.findUnique({ where: { id } });
    if (!job || !["queued", "downloading", "paused"].includes(job.status)) return;
    const now = Date.now();
    const extra = job.status === "downloading" && job.startedAt ? Math.max(0, now - job.startedAt.getTime()) : 0;
    await db.downloadJob.update({
      where: { id },
      data: {
        status: "canceled",
        accumulatedMs: job.accumulatedMs + extra,
        startedAt: null,
        completedAt: new Date(now),
      },
    });
  });
}

export async function retryJob(id: string): Promise<void> {
  return withLock(async () => {
    const job = await db.downloadJob.findUnique({ where: { id } });
    if (!job || !["failed", "canceled"].includes(job.status)) return;
    await db.downloadJob.update({
      where: { id },
      data: {
        status: "queued",
        errorMessage: null,
        failAtBytes: null, // retry reconnects and completes
        startedAt: null,
      },
    });
  });
}

export async function deleteJob(id: string): Promise<void> {
  await db.downloadJob.deleteMany({ where: { id } });
}

export async function clearHistory(): Promise<void> {
  await db.downloadJob.deleteMany({ where: { status: { in: ["completed", "failed", "canceled"] } } });
}

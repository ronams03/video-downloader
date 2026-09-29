// Shared types used by both client and server.

export type JobStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "canceled";

export type MediaKind = "video" | "audio";

export interface FormatOption {
  kind: MediaKind;
  quality: string; // "1080p" | "720p" | ... | "320 kbps"
  label: string; // "1080p · Full HD"
  format: string; // "mp4" | "mp3"
  sizeBytes: number;
}

export interface AnalyzedVideo {
  url: string;
  title: string;
  author: string;
  platform: string;
  durationSec: number;
  thumbnail: string; // "/thumbs/thumb-N.jpg"
  thumbKey: string; // "1".."5"
  formats: FormatOption[]; // video formats + audio formats
}

export interface DownloadJobDTO {
  id: string;
  url: string;
  title: string;
  author: string;
  platform: string;
  kind: MediaKind;
  quality: string;
  format: string;
  totalBytes: number;
  downloadedBytes: number;
  progress: number; // 0 - 100
  speedBps: number;
  etaSeconds: number | null;
  status: JobStatus;
  errorMessage: string | null;
  thumbKey: string;
  createdAt: string;
  completedAt: string | null;
  fileId: string | null;
}

export interface FileDTO {
  id: string;
  name: string;
  kind: MediaKind;
  quality: string;
  format: string;
  sizeBytes: number;
  durationSec: number;
  sourceUrl: string;
  thumbKey: string;
  hue: number;
  favorite: boolean;
  folderId: string | null;
  folderName: string | null;
  createdAt: string;
  streamUrl: string; // "/api/files/{id}/stream"
}

export interface FolderDTO {
  id: string;
  name: string;
  createdAt: string;
  fileCount: number;
}

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  fileCount: number;
  activeCount: number;
  historyCount: number;
}

export interface AppSettings {
  concurrency: number;
  premium: boolean;
  autoOrganize: boolean;
}

export interface DownloadRequestItem {
  url: string;
  kind: MediaKind;
  quality: string;
}

export interface CreateDownloadsResponse {
  jobs: DownloadJobDTO[];
}

export interface InsufficientStorageError {
  error: "insufficient_storage";
  message: string;
  neededBytes: number;
  freeBytes: number;
}

"use client";

import {
  DownloadCloud,
  Layers,
  Music,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format";
import type { DownloadJobDTO } from "@/lib/types";

function Thumb({ job }: { job: DownloadJobDTO }) {
  if (job.kind === "audio") {
    return (
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white"
        style={{
          background:
            "linear-gradient(135deg, hsl(160 70% 42%), hsl(200 70% 28%))",
        }}
        aria-hidden
      >
        <Music className="size-5" />
      </div>
    );
  }
  return (
    <img
      src={`/thumbs/thumb-${job.thumbKey}.jpg`}
      alt=""
      className="h-11 w-[72px] shrink-0 rounded-lg object-cover"
    />
  );
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting",
  downloading: "Downloading",
  paused: "Paused",
};

export function DownloadsPanel({
  jobs,
  concurrency,
  premium,
  onAction,
}: {
  jobs: DownloadJobDTO[];
  concurrency: number;
  premium: boolean;
  onAction: (id: string, action: "pause" | "resume" | "cancel" | "retry") => void;
}) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <DownloadCloud className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="font-medium">No active downloads</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a link above — your queue, speeds, and progress live here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Downloads</h2>
          <Badge variant="secondary">{jobs.length} active</Badge>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
          title="Parallel downloads"
        >
          <Layers className="size-3.5" aria-hidden />
          {concurrency} parallel
          {!premium && <span className="text-amber-600 dark:text-amber-400">· Premium → 4</span>}
        </span>
      </div>

      {jobs.map((job) => {
        const isDownloading = job.status === "downloading";
        const pct = Math.min(100, Math.max(0, job.progress));
        return (
          <Card key={job.id} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <Thumb job={job} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{job.title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {job.kind === "audio" ? "MP3" : "MP4"} {job.quality}
                  </Badge>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500 ease-linear ${
                      isDownloading ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Downloading ${job.title}`}
                  />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                  <span
                    className={
                      job.status === "queued"
                        ? "text-amber-600 dark:text-amber-400"
                        : isDownloading
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : ""
                    }
                  >
                    {STATUS_LABEL[job.status] ?? job.status}
                    {isDownloading ? ` · ${Math.round(pct)}%` : job.status === "queued" ? "" : ` · ${Math.round(pct)}%`}
                  </span>
                  <span>
                    {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}
                  </span>
                  {isDownloading && <span>{formatSpeed(job.speedBps)}</span>}
                  {isDownloading && job.etaSeconds != null && <span>{formatEta(job.etaSeconds)}</span>}
                  {job.status === "failed" && (
                    <span className="text-destructive">{job.errorMessage ?? "Failed"}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {isDownloading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onAction(job.id, "pause")}
                    aria-label={`Pause ${job.title}`}
                  >
                    <Pause className="size-4" aria-hidden />
                  </Button>
                )}
                {job.status === "paused" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onAction(job.id, "resume")}
                    aria-label={`Resume ${job.title}`}
                  >
                    <Play className="size-4" aria-hidden />
                  </Button>
                )}
                {job.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onAction(job.id, "retry")}
                    aria-label={`Retry ${job.title}`}
                  >
                    <RotateCcw className="size-4" aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAction(job.id, "cancel")}
                  aria-label={`Cancel ${job.title}`}
                  className="hover:text-destructive"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

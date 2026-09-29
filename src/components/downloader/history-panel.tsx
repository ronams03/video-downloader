"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { History, Music, RefreshCw, Trash, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, timeAgo } from "@/lib/format";
import type { DownloadJobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "Something went wrong");
  return data as T;
}

/** Stable pseudo-random hue (0-359) derived from a job id, for audio gradient tiles. */
function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function HistoryPanel({
  onChanged,
  onRedownload,
}: {
  onChanged?: () => void;
  onRedownload?: () => void;
}) {
  const [jobs, setJobs] = useState<DownloadJobDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [redownloadingId, setRedownloadingId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const fetchHistory = useCallback(async (options?: { silent?: boolean }) => {
    const requestId = ++requestIdRef.current;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await asJson<{ jobs: DownloadJobDTO[] }>(res);
      if (requestId !== requestIdRef.current) return;
      setJobs(data.jobs);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast.error((err as Error).message || "Failed to load history");
    } finally {
      if (requestId === requestIdRef.current && !options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const refetch = useCallback(() => {
    void fetchHistory({ silent: true });
  }, [fetchHistory]);

  async function redownload(job: DownloadJobDTO) {
    setRedownloadingId(job.id);
    try {
      await asJson<unknown>(
        await fetch("/api/downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ url: job.url, kind: job.kind, quality: job.quality }] }),
        }),
      );
      toast.success(`"${job.title}" added to queue`);
      onRedownload?.();
      refetch();
    } catch (err) {
      toast.error((err as Error).message || "Could not add to queue");
    } finally {
      setRedownloadingId(null);
    }
  }

  async function removeJob(job: DownloadJobDTO) {
    setRemovingId(job.id);
    try {
      await asJson<{ ok: boolean }>(await fetch(`/api/downloads/${job.id}`, { method: "DELETE" }));
      toast.success("Removed from history");
      refetch();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not remove record");
    } finally {
      setRemovingId(null);
    }
  }

  async function clearAll() {
    setClearing(true);
    try {
      await asJson<{ ok: boolean }>(await fetch("/api/history", { method: "DELETE" }));
      toast.success("History cleared");
      setConfirmClear(false);
      refetch();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not clear history");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Download history</h3>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${jobs.length} ${jobs.length === 1 ? "download" : "downloads"}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmClear(true)}
          disabled={loading || jobs.length === 0}
          className="h-11 shrink-0 sm:h-8"
        >
          <Trash className="size-3.5" aria-hidden="true" />
          Clear all
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3 sm:p-4">
              <Skeleton className="h-10 w-16 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 sm:w-28" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <History className="size-7 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-medium">Nothing downloaded yet.</p>
          <p className="mt-1 max-w-64 text-xs text-muted-foreground">
            Your download history will appear here — stored only on this device.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/50 sm:p-4">
              {/* Thumbnail */}
              {job.kind === "video" ? (
                <img
                  src={`/thumbs/thumb-${job.thumbKey}.jpg`}
                  alt=""
                  loading="lazy"
                  className="h-10 w-16 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hueFromId(job.id)} 70% 45%), hsl(${(hueFromId(job.id) + 40) % 360} 70% 30%))`,
                  }}
                >
                  <Music className="size-4 text-white/85" aria-hidden="true" />
                </div>
              )}

              {/* Title + meta + status */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={job.title}>
                  {job.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {job.platform} · {job.quality} · {formatBytes(job.totalBytes)} ·{" "}
                  {timeAgo(job.completedAt ?? job.createdAt)}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  {job.status === "completed" && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >
                      Completed
                    </Badge>
                  )}
                  {job.status === "failed" && (
                    <Badge
                      variant="outline"
                      className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400"
                    >
                      Failed
                    </Badge>
                  )}
                  {job.status === "canceled" && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Canceled
                    </Badge>
                  )}
                  {job.status === "failed" && job.errorMessage && (
                    <span className="truncate text-xs text-red-600 dark:text-red-400" title={job.errorMessage}>
                      {job.errorMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void redownload(job)}
                  disabled={redownloadingId === job.id}
                  className="h-11 gap-1.5 px-3 text-xs sm:h-8 sm:text-sm"
                >
                  <RefreshCw
                    className={cn("size-3.5", redownloadingId === job.id && "animate-spin")}
                    aria-hidden="true"
                  />
                  Redownload
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void removeJob(job)}
                  disabled={removingId === job.id}
                  aria-label={`Remove "${job.title}" from history`}
                  className="size-11 text-muted-foreground hover:text-destructive sm:size-8"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Clear all confirmation */}
      <AlertDialog
        open={confirmClear}
        onOpenChange={(open) => {
          if (!open) setConfirmClear(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear download history?</AlertDialogTitle>
            <AlertDialogDescription>
              All {jobs.length} {jobs.length === 1 ? "record" : "records"} will be removed. Downloaded files are kept
              on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void clearAll();
              }}
            >
              {clearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

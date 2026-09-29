"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Crown,
  FolderTree,
  HardDrive,
  Lock,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/format";
import type { AppSettings, StorageInfo } from "@/lib/types";

export function SettingsPanel({
  settings,
  storage,
  onSave,
}: {
  settings: AppSettings | null;
  storage: StorageInfo | null;
  onSave: (partial: Partial<AppSettings>) => void;
}) {
  const [localConcurrency, setLocalConcurrency] = useState<number | null>(null);
  const [clearingFiles, setClearingFiles] = useState(false);

  if (!settings) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const concurrency = localConcurrency ?? settings.concurrency;
  const usedPct = storage ? Math.round((storage.usedBytes / storage.totalBytes) * 100) : 0;
  const almostFull = usedPct >= 80;

  const clearAllFiles = async () => {
    setClearingFiles(true);
    try {
      const res = await fetch("/api/files", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? "Could not delete files.");
        return;
      }
      toast.success("All downloaded files deleted");
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setClearingFiles(false);
    }
  };

  const clearHistory = async () => {
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not clear history.");
        return;
      }
      toast.success("Download history cleared");
    } catch {
      toast.error("Network error — please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4 text-emerald-500" aria-hidden /> Storage
          </CardTitle>
          <CardDescription>Smart storage management for your library</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {storage && (
            <>
              <div className="flex items-end justify-between text-sm">
                <span className="font-semibold tabular-nums">{formatBytes(storage.usedBytes)} used</span>
                <span className="text-muted-foreground tabular-nums">
                  of {formatBytes(storage.totalBytes)} ({usedPct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    almostFull
                      ? "bg-gradient-to-r from-amber-500 to-red-500"
                      : "bg-gradient-to-r from-emerald-500 to-teal-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(1, usedPct))}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {storage.fileCount} file{storage.fileCount === 1 ? "" : "s"} · {storage.activeCount} active download
                {storage.activeCount === 1 ? "" : "s"} · {storage.historyCount} history entries
              </p>
              {almostFull && (
                <Alert className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertDescription>
                    Storage is {usedPct}% full — large downloads may be blocked. Delete old files or pick lower
                    qualities.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderTree className="size-4 text-emerald-500" aria-hidden /> Downloads
          </CardTitle>
          <CardDescription>Queue behaviour and file organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Parallel downloads</p>
                <p className="text-xs text-muted-foreground">
                  How many downloads run at the same time
                </p>
              </div>
              <span className="rounded-lg border px-3 py-1 text-sm font-semibold tabular-nums">
                {concurrency}
                {concurrency > 2 && (
                  <Crown className="ml-1 inline size-3.5 text-amber-500" aria-hidden />
                )}
              </span>
            </div>
            <Slider
              value={[concurrency]}
              min={1}
              max={4}
              step={1}
              disabled={!settings.premium && concurrency >= 2}
              onValueChange={([v]) => {
                const capped = settings.premium ? v : Math.min(v, 2);
                setLocalConcurrency(capped);
              }}
              onValueCommit={([v]) => {
                const capped = settings.premium ? v : Math.min(v, 2);
                onSave({ concurrency: capped });
              }}
              aria-label="Parallel downloads"
            />
            <p className="text-xs text-muted-foreground">
              Free plan: up to 2 · Premium: up to 4
            </p>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-organize downloads</p>
              <p className="text-xs text-muted-foreground">
                Sort finished files into Videos / Audio folders automatically
              </p>
            </div>
            <Switch
              checked={settings.autoOrganize}
              onCheckedChange={(v) => onSave({ autoOrganize: v })}
              aria-label="Auto-organize downloads"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                Simulate Premium <Crown className="size-4 text-amber-500" aria-hidden />
              </p>
              <p className="text-xs text-muted-foreground">
                Demo of the paid tier: 4× parallel, 20-link batches, priority queueing
              </p>
            </div>
            <Switch
              checked={settings.premium}
              onCheckedChange={(v) =>
                onSave({ premium: v, concurrency: v ? Math.max(4, 4) : Math.min(settings.concurrency, 2) })
              }
              aria-label="Simulate Premium"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-emerald-500" aria-hidden /> Privacy &amp; data
          </CardTitle>
          <CardDescription>You are in control — everything stays on this device</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <UserX className="size-4 text-muted-foreground" aria-hidden /> No account required
            </span>
            <span className="inline-flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" aria-hidden /> History is stored locally, never
              uploaded
            </span>
            <span className="inline-flex items-center gap-2">
              <Trash2 className="size-4 text-muted-foreground" aria-hidden /> Wipe everything with one tap,
              anytime
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="sm:flex-1">
                  <Trash2 className="size-4" aria-hidden /> Clear download history
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear download history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Finished, failed, and canceled downloads will be removed from history. Downloaded files are
                    kept in your library.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void clearHistory()}>Clear history</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive sm:flex-1">
                  <Trash2 className="size-4" aria-hidden /> Delete all files
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all downloaded files?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes every file from your library on this device. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => void clearAllFiles()}
                    disabled={clearingFiles}
                  >
                    {clearingFiles ? "Deleting…" : "Delete everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Badge variant="outline" className="w-full justify-center py-1.5 font-normal">
            PureDownload never adds a watermark to downloaded files — originals stay originals.
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

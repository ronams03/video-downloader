"use client";

import { useCallback, useRef, useState } from "react";
import {
  BadgeCheck,
  ClipboardPaste,
  CloudOff,
  Download,
  FileText,
  ListPlus,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PreviewCard } from "@/components/downloader/preview-card";
import type { AnalyzedVideo, MediaKind } from "@/lib/types";

const URL_RE = /^https?:\/\/\S+$/i;

const VIDEO_QUALITIES = ["1080p", "720p", "480p", "360p"];
const AUDIO_QUALITIES = ["320 kbps", "192 kbps", "128 kbps"];

export function HeroAnalyzer({
  premium,
  onQueued,
}: {
  premium: boolean;
  onQueued: () => void;
}) {
  const [url, setUrl] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchKind, setBatchKind] = useState<MediaKind>("video");
  const [batchQuality, setBatchQuality] = useState("720p");
  const [analyzing, setAnalyzing] = useState(false);
  const [queuedBatch, setQueuedBatch] = useState(false);
  const [analyzed, setAnalyzed] = useState<AnalyzedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoAnalyzedRef = useRef<string | null>(null);

  const analyze = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Could not analyze this link.");
        setAnalyzed(null);
      } else {
        setAnalyzed(data.video as AnalyzedVideo);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        if (URL_RE.test(text.trim())) void analyze(text.trim());
      }
    } catch {
      toast("Clipboard unavailable — press Ctrl+V into the field instead.");
    }
  }, [analyze]);

  // Smart link detection: pasting a URL into the field auto-analyzes it.
  const onInputPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text")?.trim();
      if (text && URL_RE.test(text) && autoAnalyzedRef.current !== text) {
        autoAnalyzedRef.current = text;
        setTimeout(() => void analyze(text), 0);
      }
    },
    [analyze],
  );

  const batchUrls = batchText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => URL_RE.test(l));
  const maxBatch = premium ? 20 : 5;
  const overLimit = batchUrls.length > maxBatch;

  const queueBatch = useCallback(async () => {
    if (batchUrls.length === 0 || overLimit) return;
    setQueuedBatch(true);
    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: batchUrls.map((u) => ({ url: u, kind: batchKind, quality: batchQuality })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not queue these links.");
        return;
      }
      toast.success(`${batchUrls.length} link${batchUrls.length > 1 ? "s" : ""} queued`, {
        description: `Queued as ${batchKind === "video" ? batchQuality + " MP4" : batchQuality + " MP3"}.`,
      });
      setBatchText("");
      onQueued();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setQueuedBatch(false);
    }
  }, [batchUrls, overLimit, batchKind, batchQuality, onQueued]);

  return (
    <section className="pb-10 pt-8 sm:pt-12">
      <div className="mx-auto max-w-2xl text-center">
        <Badge
          variant="outline"
          className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400"
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          No added watermarks. Ever.
        </Badge>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Video Downloader,
          <span className="block bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
            clean as the original.
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-balance text-muted-foreground">
          Paste a link, pick a quality, and save videos or MP3s straight to this device —
          byte-for-byte, with nothing stamped on top.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="size-3.5 text-emerald-500" aria-hidden /> No account required
          </span>
          <span className="inline-flex items-center gap-1">
            <CloudOff className="size-3.5 text-emerald-500" aria-hidden /> Local history only
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5 text-emerald-500" aria-hidden /> Built-in file manager
          </span>
        </div>
      </div>

      <Card className="mx-auto mt-8 max-w-2xl border-emerald-500/20 text-left shadow-lg shadow-emerald-500/5">
        <CardContent className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void analyze(url);
              }}
              onPaste={onInputPaste}
              placeholder="Paste a video link (YouTube, TikTok, X, Vimeo, direct file…)"
              className="h-12 flex-1 text-base"
              aria-label="Video URL"
              inputMode="url"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-3"
                onClick={handlePaste}
                aria-label="Paste from clipboard"
              >
                <ClipboardPaste className="size-4" aria-hidden />
              </Button>
              <Button
                size="lg"
                className="h-12 flex-1 px-5 sm:flex-none"
                onClick={() => void analyze(url)}
                disabled={analyzing || !url.trim()}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Analyzing…
                  </>
                ) : (
                  <>
                    <Search className="size-4" aria-hidden /> Analyze Video
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
              onClick={() => setBatchMode((v) => !v)}
            >
              <ListPlus className="size-3.5" aria-hidden />
              {batchMode ? "Back to single link" : "Batch mode — queue multiple links"}
            </button>
            <span className="text-muted-foreground">
              Paste a link and it&apos;s analyzed automatically
            </span>
          </div>

          {batchMode && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
              <Textarea
                rows={4}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"https://youtu.be/…\nhttps://tiktok.com/@user/video/…\none link per line"}
                className="resize-none bg-background text-sm"
                aria-label="Batch URLs, one per line"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select value={batchKind} onValueChange={(v) => { setBatchKind(v as MediaKind); setBatchQuality(v === "video" ? "720p" : "320 kbps"); }}>
                  <SelectTrigger className="h-9 w-[130px]" aria-label="Batch media type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video · MP4</SelectItem>
                    <SelectItem value="audio">Audio · MP3</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={batchQuality} onValueChange={setBatchQuality}>
                  <SelectTrigger className="h-9 w-[130px]" aria-label="Batch quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(batchKind === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES).map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="ml-auto"
                  onClick={() => void queueBatch()}
                  disabled={queuedBatch || batchUrls.length === 0 || overLimit}
                >
                  {queuedBatch ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Queueing…
                    </>
                  ) : (
                    <>
                      <Download className="size-4" aria-hidden /> Queue all ({batchUrls.length})
                    </>
                  )}
                </Button>
              </div>
              <p className={`text-xs ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {overLimit
                  ? `${batchUrls.length} links — the ${premium ? "Premium" : "Free"} plan allows ${maxBatch} per batch.`
                  : `${maxBatch} links per batch on the ${premium ? "Premium" : "Free"} plan · default ${batchKind === "video" ? batchQuality + " MP4" : batchQuality + " MP3"}`}
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {analyzing && (
            <div className="flex gap-4 rounded-xl border p-4">
              <Skeleton className="aspect-video w-40 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {analyzed && !analyzing && (
        <PreviewCard analyzed={analyzed} onQueued={onQueued} onDismiss={() => setAnalyzed(null)} />
      )}

      <p className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-amber-500" aria-hidden />
        <Wand2 className="size-3.5 text-amber-500" aria-hidden />
        Prototype note: link analysis &amp; transfer are simulated in this demo sandbox — completed files play for real.
      </p>
    </section>
  );
}

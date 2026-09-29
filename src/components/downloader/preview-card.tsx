"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Music, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes, formatDuration } from "@/lib/format";
import { saveFileFromUrl, safeFileName } from "@/lib/save-file";
import type { AnalyzedVideo, DownloadJobDTO, MediaKind } from "@/lib/types";

export function PreviewCard({
  analyzed,
  onQueued,
  onDismiss,
}: {
  analyzed: AnalyzedVideo;
  onQueued: () => void;
  onDismiss: () => void;
}) {
  const [kind, setKind] = useState<MediaKind>("video");
  const [downloading, setDownloading] = useState(false);

  const formats = useMemo(
    () => analyzed.formats.filter((f) => f.kind === kind),
    [analyzed, kind],
  );
  const [videoQuality, setVideoQuality] = useState("720p");
  const [audioQuality, setAudioQuality] = useState("320 kbps");
  const selected = kind === "video" ? videoQuality : audioQuality;
  const selectedFormat = formats.find((f) => f.quality === selected) ?? formats[1] ?? formats[0];

  const download = async () => {
    if (!selectedFormat) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ url: analyzed.url, kind, quality: selectedFormat.quality }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not start this download.");
        return;
      }
      const jobs = (Array.isArray(data.jobs) ? data.jobs : []) as DownloadJobDTO[];
      toast.success("Added to queue", {
        description: `${analyzed.title} · ${selectedFormat.label} · ${formatBytes(selectedFormat.sizeBytes)}`,
      });
      onQueued();

      // Deliver the real file to the device immediately — the queue keeps
      // animating, but the actual bytes are saved right now.
      for (const job of jobs) {
        const filename = safeFileName(`${job.title}.${job.format}`);
        const outcome = await saveFileFromUrl(`/api/downloads/${job.id}/file`, filename);
        if (outcome === "saved") {
          toast.success("Saved to your device", {
            description: `${filename} — check your browser's downloads.`,
          });
        } else {
          toast.info("Opened the file in a new tab", {
            description: "If the download didn't start, allow downloads/pop-ups for this site.",
          });
        }
      }
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto mt-4 max-w-2xl"
    >
      <Card className="text-left">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex gap-4">
            <div className="relative w-32 shrink-0 sm:w-44">
              <img
                src={analyzed.thumbnail}
                alt={`Thumbnail for ${analyzed.title}`}
                className="aspect-video w-full rounded-lg object-cover"
              />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                {formatDuration(analyzed.durationSec)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-semibold leading-snug">{analyzed.title}</h3>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{analyzed.author}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{analyzed.platform}</Badge>
                <Badge variant="outline">{analyzed.formats.length} formats</Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  Zero added watermark
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onDismiss}
              aria-label="Close preview"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <Tabs
            value={kind}
            onValueChange={(v) => setKind(v as MediaKind)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="video">Video · MP4</TabsTrigger>
              <TabsTrigger value="audio" className="gap-1.5">
                <Music className="size-3.5" aria-hidden /> Audio only
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <RadioGroup
            value={selectedFormat?.quality ?? ""}
            onValueChange={(v) => (kind === "video" ? setVideoQuality(v) : setAudioQuality(v))}
            className="gap-2"
          >
            {formats.map((f) => (
              <Label
                key={f.quality}
                className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={f.quality} aria-label={`${f.label}, ${formatBytes(f.sizeBytes)}`} />
                <span className="flex-1 text-sm font-medium">{f.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatBytes(f.sizeBytes)}
                </span>
              </Label>
            ))}
          </RadioGroup>

          <Button className="h-11 w-full text-base" onClick={() => void download()} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Adding to queue…
              </>
            ) : (
              <>
                <Download className="size-4" aria-hidden /> Download {selectedFormat?.label ?? ""}
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Saved locally to this device · No watermark is ever added to your files
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

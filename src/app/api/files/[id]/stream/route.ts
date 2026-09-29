import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SAMPLE_MAP: Record<string, string> = {
  "sample-video-1": "sample-video-1.mp4",
  "sample-video-2": "sample-video-2.mp4",
  "sample-audio-1": "sample-audio-1.mp3",
};

const MIME_BY_FORMAT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await db.mediaFile.findUnique({ where: { id } });
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const fileName = SAMPLE_MAP[file.filePath];
  if (!fileName) {
    return new Response("Media source unavailable", { status: 404 });
  }

  const filePath = `${process.cwd()}/media/samples/${fileName}`;
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new Response("Media file missing on disk", { status: 404 });
  }

  const mime = MIME_BY_FORMAT[file.format] ?? "application/octet-stream";
  const safeName = file.name.replace(/"/g, "") || `download.${file.format}`;
  const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";

  // Minimal Range support so <video> seeking works in Chromium.
  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), buffer.length - 1) : buffer.length - 1;
      if (start <= end && start < buffer.length) {
        const slice = buffer.subarray(start, end + 1);
        return new Response(new Uint8Array(slice), {
          status: 206,
          headers: {
            "Content-Type": mime,
            "Content-Length": String(slice.length),
            "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
            "Accept-Ranges": "bytes",
            "Content-Disposition": `${disposition}; filename="${safeName}"`,
          },
        });
      }
    }
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}

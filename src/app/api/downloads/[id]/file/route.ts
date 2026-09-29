import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { samplePathFor } from "@/lib/engine";

export const dynamic = "force-dynamic";

const MIME_BY_FORMAT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

function sanitizeName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/"/g, "")
      .slice(0, 120) || "download"
  );
}

/**
 * Serves the real media bytes for a download job as a file attachment.
 *
 * This is what makes the "Download" button deliver an actual file to the
 * user's device the moment they click it (instead of only queueing a
 * simulated transfer). The filename is derived from the job title so the
 * saved file matches what the app shows in the queue and library.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await db.downloadJob.findUnique({ where: { id } });
  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const key = samplePathFor(job.kind, job.id);
  const extension = job.kind === "audio" ? "mp3" : "mp4";
  const filePath = `${process.cwd()}/media/samples/${key}.${extension}`;

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new Response("Media file missing on disk", { status: 404 });
  }

  const mime = MIME_BY_FORMAT[job.format] ?? "application/octet-stream";
  const safeName = sanitizeName(`${job.title}.${job.format}`);

  // HTTP headers are ByteStrings (Latin-1). Titles may contain characters like
  // "—" (U+2014) which crash Response construction, so send an ASCII fallback
  // plus the RFC 5987 UTF-8 encoded form.
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const utf8Name = encodeURIComponent(safeName);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "no-store",
    },
  });
}

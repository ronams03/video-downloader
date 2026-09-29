import { NextRequest, NextResponse } from "next/server";
import { db, isEphemeralDb } from "@/lib/db";
import { syncJobs, toFileDTO } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await syncJobs();
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? "all"; // all | videos | audio | favorites
  const folderId = sp.get("folderId") ?? "all"; // all | root | <folder id>
  const search = (sp.get("search") ?? "").trim();
  const sort = sp.get("sort") ?? "date"; // name | date | size

  const where: Record<string, unknown> = {};
  if (category === "videos") where.kind = "video";
  if (category === "audio") where.kind = "audio";
  if (category === "favorites") where.favorite = true;
  if (folderId === "root") where.folderId = null;
  else if (folderId !== "all") where.folderId = folderId;
  if (search) where.name = { contains: search };

  const orderBy =
    sort === "name" ? { name: "asc" as const } : sort === "size" ? { sizeBytes: "desc" as const } : { createdAt: "desc" as const };

  const files = await db.mediaFile.findMany({
    where,
    orderBy,
    take: 200,
    include: { folder: { select: { name: true } } },
  });

  const folders = await db.folder.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await db.mediaFile.groupBy({ by: ["folderId"], _count: { _all: true } });
  const countMap = new Map(counts.map((c) => [c.folderId ?? "root", c._count._all]));

  return NextResponse.json({
    files: files.map((f) => toFileDTO({ ...f, folderName: f.folder?.name ?? null })),
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt.toISOString(),
      fileCount: countMap.get(f.id) ?? 0,
    })),
    ephemeral: isEphemeralDb(),
  });
}

export async function DELETE() {
  // Privacy feature: wipe the entire local library (folders are kept).
  await db.mediaFile.deleteMany({});
  return NextResponse.json({ ok: true });
}

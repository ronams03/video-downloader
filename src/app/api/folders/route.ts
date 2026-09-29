import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EngineError } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const folders = await db.folder.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await db.mediaFile.groupBy({ by: ["folderId"], _count: { _all: true } });
  const countMap = new Map(counts.map((c) => [c.folderId ?? "root", c._count._all]));
  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt.toISOString(),
      fileCount: countMap.get(f.id) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (!name) throw new EngineError("bad_name", "Folder name is required.", 400);
    const existing = await db.folder.findFirst({ where: { name } });
    if (existing) throw new EngineError("duplicate", "A folder with this name already exists.", 409);
    const folder = await db.folder.create({ data: { name } });
    return NextResponse.json(
      { folder: { id: folder.id, name: folder.name, createdAt: folder.createdAt.toISOString(), fileCount: 0 } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EngineError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "create_failed", message: "Could not create folder." }, { status: 500 });
  }
}

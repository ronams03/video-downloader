import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toFileDTO } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim().slice(0, 120);
  }
  if (typeof body.favorite === "boolean") {
    data.favorite = body.favorite;
  }
  if (body.folderId === null || typeof body.folderId === "string") {
    data.folderId = body.folderId;
  }

  const file = await db.mediaFile.update({
    where: { id },
    data,
    include: { folder: { select: { name: true } } },
  });
  return NextResponse.json({ file: toFileDTO({ ...file, folderName: file.folder?.name ?? null }) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.mediaFile.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}

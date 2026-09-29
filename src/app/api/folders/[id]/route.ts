import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Files inside are kept and moved to the root (folderId set null by schema action).
  await db.folder.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}

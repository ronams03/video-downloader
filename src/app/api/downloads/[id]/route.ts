import { NextRequest, NextResponse } from "next/server";
import { deleteJob } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteJob(id);
  return NextResponse.json({ ok: true });
}

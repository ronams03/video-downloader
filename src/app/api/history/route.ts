import { NextResponse } from "next/server";
import { clearHistory, historyJobs, syncJobs } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  await syncJobs();
  const jobs = await historyJobs();
  return NextResponse.json({ jobs });
}

export async function DELETE() {
  await clearHistory();
  return NextResponse.json({ ok: true });
}

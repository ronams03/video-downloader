import { NextResponse } from "next/server";
import { storageInfo, syncJobs } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  await syncJobs();
  const storage = await storageInfo();
  return NextResponse.json({ storage });
}

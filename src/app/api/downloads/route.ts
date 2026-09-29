import { NextRequest, NextResponse } from "next/server";
import {
  EngineError,
  activeJobs,
  createJobs,
  getSettings,
  syncJobs,
} from "@/lib/engine";
import type { DownloadRequestItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await syncJobs();
  const [jobs, settings] = await Promise.all([activeJobs(), getSettings()]);
  return NextResponse.json({
    jobs,
    concurrency: settings.concurrency,
    premium: settings.premium,
    events,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const items: DownloadRequestItem[] = Array.isArray(body.items) ? body.items : [];
    const jobs = await createJobs(items);
    return NextResponse.json({ jobs }, { status: 201 });
  } catch (error) {
    if (error instanceof EngineError) {
      const payload: Record<string, unknown> = { error: error.code, message: error.message };
      return NextResponse.json(payload, { status: error.status });
    }
    return NextResponse.json(
      { error: "create_failed", message: "Could not add these downloads to the queue." },
      { status: 500 },
    );
  }
}

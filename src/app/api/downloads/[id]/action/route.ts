import { NextRequest, NextResponse } from "next/server";
import {
  cancelJob,
  jobDTOById,
  pauseJob,
  resumeJob,
  retryJob,
  syncJobs,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "pause":
      await pauseJob(id);
      break;
    case "resume":
      await resumeJob(id);
      await syncJobs();
      break;
    case "cancel":
      await cancelJob(id);
      break;
    case "retry":
      await retryJob(id);
      await syncJobs();
      break;
    default:
      return NextResponse.json({ error: "bad_action", message: "Unknown action." }, { status: 400 });
  }

  const job = await jobDTOById(id);
  return NextResponse.json({ job });
}

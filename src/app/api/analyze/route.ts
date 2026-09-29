import { NextRequest, NextResponse } from "next/server";
import { EngineError, analyzeUrl } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url : "";
    const analyzed = analyzeUrl(url);
    return NextResponse.json({ ok: true, video: analyzed });
  } catch (error) {
    if (error instanceof EngineError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "analyze_failed", message: "Could not analyze this link. Try another URL." },
      { status: 500 },
    );
  }
}

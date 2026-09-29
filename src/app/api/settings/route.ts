import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/engine";
import type { AppSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const partial: Partial<AppSettings> = {};
  if (typeof body.concurrency === "number") partial.concurrency = body.concurrency;
  if (typeof body.premium === "boolean") partial.premium = body.premium;
  if (typeof body.autoOrganize === "boolean") partial.autoOrganize = body.autoOrganize;
  const settings = await saveSettings(partial);
  return NextResponse.json({ settings });
}

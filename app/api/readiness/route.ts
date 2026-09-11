import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabase();
    return NextResponse.json(
      { status: "ready", database: "connected" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready", database: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

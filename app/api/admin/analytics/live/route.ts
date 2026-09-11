import { NextRequest, NextResponse } from "next/server";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { getLiveVisitors } from "@/lib/database";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!parseSession(request.cookies.get(adminCookie.name)?.value)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ visitors: getLiveVisitors() }, { headers: { "cache-control": "no-store" } });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { heartbeatVisitor } from "@/lib/database";
import { anonymizeIp } from "@/lib/security";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({ visitorId: z.string().uuid(), path: z.string().startsWith("/").max(240) });
export async function POST(request: NextRequest) {
  if (!allowRequest(request, "analytics-heartbeat", 120, 60_000)) return new NextResponse(null, { status: 429 });
  try {
    const { visitorId, path } = schema.parse(await request.json());
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";
    const device = /mobile|android|iphone/i.test(ua) ? "Celular" : /tablet|ipad/i.test(ua) ? "Tablet" : "Computador";
    heartbeatVisitor({ visitorId, path, device, ipHash: anonymizeIp(forwarded) });
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 400 }); }
}

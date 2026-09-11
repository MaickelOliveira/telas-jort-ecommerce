import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/lib/database";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({
  visitorId: z.string().uuid(),
  event: z.enum(["add_to_cart", "begin_checkout", "purchase"]),
  path: z.string().startsWith("/").max(240),
  metadata: z.record(z.string().max(40), z.union([z.string().max(120), z.number().finite()])).optional(),
});
export async function POST(request: NextRequest) {
  if (!allowRequest(request, "analytics-event", 120, 60_000)) return new NextResponse(null, { status: 429 });
  try {
    const input = schema.parse(await request.json());
    await recordAnalyticsEvent(input.visitorId, input.event, input.path, input.metadata);
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 400 }); }
}

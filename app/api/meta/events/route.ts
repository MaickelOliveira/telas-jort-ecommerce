import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMetaConversionEvent } from "@/lib/integrations/meta-conversions";
import { allowRequest, clientIp, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  consent: z.literal(true),
  eventName: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo"]),
  eventId: z.string().uuid(),
  path: z.string().startsWith("/").max(500),
  customData: z.object({
    currency: z.string().length(3).optional(),
    value: z.number().finite().min(0).max(100_000_000).optional(),
    content_name: z.string().max(200).optional(),
    content_category: z.string().max(120).optional(),
    content_type: z.enum(["product", "product_group"]).optional(),
    content_ids: z.array(z.string().max(120)).max(50).optional(),
    num_items: z.number().int().min(1).max(99_999).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "meta-events", 120, 60_000)) return new NextResponse(null, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (request.cookies.get("tj_meta_consent")?.value !== "granted") return new NextResponse(null, { status: 204 });
  try {
    const input = schema.parse(await request.json());
    const origin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin;
    await sendMetaConversionEvent({
      eventName: input.eventName,
      eventId: input.eventId,
      eventSourceUrl: new URL(input.path, origin).toString(),
      customData: input.customData,
      userData: {
        fbp: request.cookies.get("_fbp")?.value,
        fbc: request.cookies.get("_fbc")?.value,
        clientIpAddress: clientIp(request),
        clientUserAgent: request.headers.get("user-agent") || undefined,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Meta CAPI event failed", error);
    return new NextResponse(null, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}

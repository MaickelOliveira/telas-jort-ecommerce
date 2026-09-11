import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateCart } from "@/lib/calculation";
import { getRuntimeProducts } from "@/lib/catalog-server";
import { validateCoupon } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const itemSchema = z.object({
  lineId: z.string().min(1).max(100), productId: z.string().min(1).max(120), quantity: z.number().int().min(1).max(999),
  selection: z.object({ lengthM: z.number().positive().max(1000).optional(), heightM: z.number().positive().max(20).optional() }).optional(),
});
const schema = z.object({ code: z.string().trim().min(3).max(30), items: z.array(itemSchema).min(1).max(50) });

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "checkout-coupon", 30, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas de cupom. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const cart = calculateCart(input.items, getRuntimeProducts());
    const result = validateCoupon(input.code, cart.subtotalCents);
    if (!result.valid) return NextResponse.json({ error: result.message }, { status: 422 });
    return NextResponse.json({ code: result.coupon.code, discountCents: result.discountCents, message: result.message }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Informe um cupom válido." : "Não foi possível validar o cupom." }, { status: 400 });
  }
}

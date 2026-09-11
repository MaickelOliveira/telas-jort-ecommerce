import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { quoteShipping } from "@/lib/integrations/melhor-envio";
import { getRuntimeProducts } from "@/lib/catalog-server";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const itemSchema = z.object({
  lineId: z.string().min(1).max(100), productId: z.string().min(1).max(120), quantity: z.number().int().min(1).max(999),
  selection: z.object({ lengthM: z.number().positive().max(1000).optional(), heightM: z.number().positive().max(20).optional() }).optional(),
});
const schema = z.object({ postalCode: z.string().regex(/^\d{8}$/), items: z.array(itemSchema).min(1).max(50) });

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "shipping", 60, 60_000)) return NextResponse.json({ error: "Muitas cotações. Aguarde um instante." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem da solicitação inválida" }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const result = await quoteShipping(input.postalCode, input.items, await getRuntimeProducts());
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Confira o CEP e os itens do carrinho." : error instanceof Error ? error.message : "Erro ao calcular o frete.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

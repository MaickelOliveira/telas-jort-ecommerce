import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { setMarketplaceProductActive } from "@/lib/integrations/marketplaces";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const inputSchema = z.object({
  channel: z.enum(["mercado_livre", "shopee"]),
  externalId: z.string().trim().min(1).max(100),
  active: z.boolean(),
});

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "marketplace-product-status", 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas alterações em sequência. Aguarde alguns minutos." }, { status: 429 });
  }
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode ativar ou pausar anúncios." }, { status: 403 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem da solicitação inválida" }, { status: 403 });

  try {
    const input = inputSchema.parse(await request.json());
    const result = await setMarketplaceProductActive(input.channel, input.externalId, input.active);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Produto ou canal inválido."
      : error instanceof Error ? error.message : "Não foi possível alterar o anúncio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

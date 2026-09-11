import { NextRequest, NextResponse } from "next/server";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { getStoredOrderByPublicNumber } from "@/lib/database";
import { issueFiscalInvoiceForOrder } from "@/lib/integrations/focus-nfe";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicNumber: string }> }) {
  if (!allowRequest(request, "admin-fiscal-issue", 30, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { publicNumber } = await params;
  const order = await getStoredOrderByPublicNumber(publicNumber);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.status !== "paid") return NextResponse.json({ error: "A NF-e só pode ser emitida depois da aprovação do pagamento." }, { status: 409 });
  const result = await issueFiscalInvoiceForOrder(publicNumber);
  if (!result.ok) {
    const status = "skipped" in result && result.skipped ? 409 : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(result);
}

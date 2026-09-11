import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerCookie, parseCustomerSession } from "@/lib/customer-auth";
import { audit, createCustomerRefundRequest, getStoredOrderForCustomer } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({ reason: z.string().trim().min(10, "Explique o motivo em pelo menos 10 caracteres.").max(500) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ publicNumber: string }> }) {
  if (!allowRequest(request, "customer-refund-request", 8, 60 * 60_000)) return NextResponse.json({ error: "Muitas solicitações. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = parseCustomerSession(request.cookies.get(customerCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Entre novamente na sua conta." }, { status: 401 });
  try {
    const { publicNumber } = await context.params;
    const order = getStoredOrderForCustomer(publicNumber, session.customerId);
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    const input = schema.parse(await request.json());
    const refundRequest = createCustomerRefundRequest({ orderId: order.id, customerAccountId: session.customerId, reason: input.reason });
    audit(session.email, "customer.refund_requested", order.public_number, { refundRequestId: refundRequest.id });
    return NextResponse.json({ ok: true, request: { id: refundRequest.id, status: refundRequest.status } });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Não foi possível enviar a solicitação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

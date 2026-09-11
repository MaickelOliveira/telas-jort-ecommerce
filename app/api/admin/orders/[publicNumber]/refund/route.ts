import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { audit, completeAdminRefund, failAdminRefund, getStoredOrderByPublicNumber, startAdminRefund, updateCustomerRefundRequest } from "@/lib/database";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { requestAppmaxRefund } from "@/lib/integrations/appmax";
import { refundMercadoPagoPayment } from "@/lib/integrations/mercado-pago";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),
  reason: z.string().trim().min(5, "Informe o motivo do estorno.").max(500),
  idempotencyKey: z.string().uuid(),
  customerRequestId: z.string().uuid().optional(),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ publicNumber: string }> }) {
  if (!allowRequest(request, "admin-order-refund", 10, 60 * 60_000)) return NextResponse.json({ error: "Muitas tentativas de estorno. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode estornar pagamentos." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const { publicNumber } = await context.params;
    const order = await getStoredOrderByPublicNumber(publicNumber);
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (!order.payment_provider_id) throw new Error("Este pedido não possui uma cobrança vinculada.");
    const [mercadoPago, appmax] = await Promise.all([
      getRuntimeIntegrationConfig("mercado_pago"),
      getRuntimeIntegrationConfig("appmax"),
    ]);
    const provider = order.payment_provider || (mercadoPago.enabled && !appmax.enabled ? "mercado_pago" : null);
    if (!provider) throw new Error("Não foi possível identificar o provedor deste pagamento.");
    const remainingCents = Number(order.total_cents) - Number(order.refunded_cents || 0);
    if (input.amountCents > remainingCents) throw new Error("O valor informado supera o saldo disponível para estorno.");
    const full = input.amountCents === Number(order.total_cents) && Number(order.refunded_cents || 0) === 0;
    const started = await startAdminRefund({ requestId: input.idempotencyKey, orderId: order.id, amountCents: input.amountCents, reason: input.reason, provider, actor: session.email });
    if (!started.created) {
      if (started.request.status === "completed") return NextResponse.json({ ok: true, status: "completed" });
      throw new Error("Esta solicitação de estorno já está sendo processada.");
    }
    try {
      const providerResult = provider === "mercado_pago"
        ? await refundMercadoPagoPayment({ paymentId: order.payment_provider_id, amountCents: input.amountCents, full, idempotencyKey: input.idempotencyKey })
        : await requestAppmaxRefund({ orderId: order.payment_provider_id, amountCents: input.amountCents, full });
      if (provider === "mercado_pago") {
        await completeAdminRefund({ requestId: input.idempotencyKey, providerRefundId: providerResult.id, actor: session.email });
        await updateCustomerRefundRequest({ requestId: input.customerRequestId, orderId: order.id, status: "completed", actor: session.email });
        await audit(session.email, "order.refund_completed", order.public_number, { amountCents: input.amountCents, provider, providerRefundId: providerResult.id });
        return NextResponse.json({ ok: true, status: "completed", refundedCents: Number(order.refunded_cents || 0) + input.amountCents });
      }
      await updateCustomerRefundRequest({ requestId: input.customerRequestId, orderId: order.id, status: "processing", actor: session.email });
      await audit(session.email, "order.refund_processing", order.public_number, { amountCents: input.amountCents, provider, providerRefundId: providerResult.id });
      return NextResponse.json({ ok: true, status: "processing" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "O provedor recusou o estorno.";
      await failAdminRefund({ requestId: input.idempotencyKey, message, actor: session.email });
      await updateCustomerRefundRequest({ requestId: input.customerRequestId, orderId: order.id, status: "failed", actor: session.email, message });
      await audit(session.email, "order.refund_failed", order.public_number, { amountCents: input.amountCents, provider, message });
      throw error;
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Confira os dados do estorno." : error instanceof Error ? error.message : "Não foi possível realizar o estorno.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { fetchMercadoPagoPayment } from "@/lib/integrations/mercado-pago";
import { finishWebhook, getStoredOrderByPublicNumber, listStoredOrderItems, startWebhook, syncOrderRefundByPublicNumber, updateOrderPaymentByPublicNumber } from "@/lib/database";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { sendMetaConversionEvent } from "@/lib/integrations/meta-conversions";
import { issueFiscalInvoiceForOrder } from "@/lib/integrations/focus-nfe";

export const runtime = "nodejs";
async function validSignature(request: NextRequest, dataId: string) {
  const secret = (await getRuntimeIntegrationConfig("mercado_pago")).secrets.webhookSecret;
  if (!secret) return process.env.NODE_ENV !== "production";
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!parts.ts || !parts.v1 || !requestId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"));
  const supplied = Buffer.from(parts.v1);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as { action?: string; type?: string; data?: { id?: string | number }; id?: string | number };
  const dataId = String(url.searchParams.get("data.id") || body.data?.id || body.id || "");
  if (!dataId || !await validSignature(request, dataId)) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  const eventId = `${body.action || body.type || "payment"}:${dataId}:${request.headers.get("x-request-id") || "unknown"}`;
  if (!await startWebhook("mercado_pago", eventId)) return NextResponse.json({ received: true, duplicate: true });
  try {
    const payment = await fetchMercadoPagoPayment(dataId);
    if (payment.external_reference) {
      const refundedCents = Math.round(Number(payment.transaction_amount_refunded || 0) * 100);
      if (String(payment.status).toLowerCase() === "refunded") await syncOrderRefundByPublicNumber(payment.external_reference);
      else if (refundedCents > 0) await syncOrderRefundByPublicNumber(payment.external_reference, refundedCents);
      else await updateOrderPaymentByPublicNumber(payment.external_reference, String(payment.status || "pending"), String(payment.id || dataId), "mercado_pago");
      if (["approved", "paid"].includes(String(payment.status || "").toLowerCase())) {
        const order = await getStoredOrderByPublicNumber(payment.external_reference);
        if (order) after(() => issueFiscalInvoiceForOrder(order.public_number).catch((error) => console.error("Automatic NF-e issuance failed", error)));
        if (order?.customer._metaClientIp) {
          const items = await listStoredOrderItems(order.id);
          const name = String(order.customer.name || "").trim().split(/\s+/);
          await sendMetaConversionEvent({
            eventName: "Purchase",
            eventId: `purchase-${order.public_number}`,
            eventSourceUrl: new URL("/checkout", process.env.APP_URL || request.nextUrl.origin).toString(),
            customData: { value: Number(order.total_cents) / 100, currency: "BRL", content_type: "product", content_ids: items.map((item) => item.product_id), contents: items.map((item) => ({ id: item.product_id, quantity: item.quantity, item_price: item.unit_price_cents / 100 })) },
            userData: {
              email: order.customer.email,
              phone: order.customer.phone,
              firstName: name[0],
              lastName: name.slice(1).join(" "),
              city: order.customer.city,
              state: order.customer.state,
              postalCode: order.customer.postalCode,
              country: "br",
              externalId: order.customer.email,
              fbp: order.customer._metaFbp,
              fbc: order.customer._metaFbc,
              clientIpAddress: order.customer._metaClientIp,
              clientUserAgent: order.customer._metaClientUserAgent,
            },
          }).catch((error) => console.error("Meta webhook Purchase failed", error));
        }
      }
    }
    await finishWebhook("mercado_pago", eventId, "processed");
    return NextResponse.json({ received: true });
  } catch {
    await finishWebhook("mercado_pago", eventId, "failed");
    return NextResponse.json({ error: "Falha temporária" }, { status: 500 });
  }
}

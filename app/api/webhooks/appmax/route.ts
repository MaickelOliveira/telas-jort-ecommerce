import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeAdminRefund, finishWebhook, getStoredOrderByProviderId, listRefundRequestsForOrder, startWebhook, updateOrderPaymentByProviderId } from "@/lib/database";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { fetchAppmaxOrder } from "@/lib/integrations/appmax";
import { issueFiscalInvoiceForOrder } from "@/lib/integrations/focus-nfe";

export const runtime = "nodejs";

const schema = z.object({
  event: z.string().min(3).max(100),
  event_type: z.enum(["order", "payment", "customer", "subscription"]),
  site_id: z.string().max(100).optional(),
  app_id: z.string().max(100).optional(),
  data: z.object({ order_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(), customer_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional() }).passthrough(),
}).passthrough();

export async function POST(request: NextRequest) {
  const config = await getRuntimeIntegrationConfig("appmax");
  if (!config.enabled) return NextResponse.json({ received: false }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ received: true });
  const payload = parsed.data;
  if (config.publicConfig.appId && payload.app_id !== config.publicConfig.appId) return NextResponse.json({ received: false }, { status: 401 });
  if (config.publicConfig.siteId && payload.site_id !== config.publicConfig.siteId) return NextResponse.json({ received: false }, { status: 401 });
  const resourceId = String(payload.data.order_id || payload.data.customer_id || "unknown");
  const eventId = `${payload.event}:${resourceId}`;
  if (!await startWebhook("appmax", eventId)) return NextResponse.json({ received: true, duplicate: true });
  after(async () => {
    try {
      if (payload.data.order_id) {
        const order = await fetchAppmaxOrder(String(payload.data.order_id));
        await updateOrderPaymentByProviderId(String(order.id), String(order.status || "pending"), "appmax");
        const localOrder = await getStoredOrderByProviderId(String(order.id));
        if (localOrder && ["approved", "paid", "pago", "aprovado"].includes(String(order.status || "").toLowerCase())) {
          await issueFiscalInvoiceForOrder(localOrder.public_number);
        }
        if (["order_refund", "order_partial_refund"].includes(payload.event)) {
          if (localOrder) {
            const pending = (await listRefundRequestsForOrder(localOrder.id)).find((item) => item.status === "processing" && item.provider === "appmax");
            if (pending) await completeAdminRefund({ requestId: pending.id, actor: "webhook:appmax" });
          }
        }
      }
      await finishWebhook("appmax", eventId, "processed");
    } catch {
      await finishWebhook("appmax", eventId, "failed");
    }
  });
  return NextResponse.json({ received: true });
}

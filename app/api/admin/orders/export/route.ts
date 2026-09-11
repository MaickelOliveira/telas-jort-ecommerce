import { NextRequest, NextResponse } from "next/server";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { listStoredOrders } from "@/lib/database";

export const runtime = "nodejs";
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  if (!parseSession(request.cookies.get(adminCookie.name)?.value)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const header = ["Pedido", "Data", "Status", "Pagamento", "Envio", "Cliente", "E-mail", "Telefone", "Cidade", "UF", "Frete", "Cupom", "Desconto", "Total"].map(csv).join(",");
  const rows = (await listStoredOrders(5000)).map((order) => {
    const customer = order.customer as Record<string, string>;
    return [order.public_number, order.created_at, order.status, order.payment_status, order.fulfillment_status, customer.name, customer.email, customer.phone, customer.city, customer.state, Number(order.shipping_cents) / 100, order.coupon_code, Number(order.discount_cents) / 100, Number(order.total_cents) / 100].map(csv).join(",");
  });
  return new NextResponse(`\uFEFF${[header, ...rows].join("\r\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pedidos-telas-jort-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}

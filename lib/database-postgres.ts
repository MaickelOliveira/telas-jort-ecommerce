import "server-only";
import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { decryptPrivateJson, encryptPrivateJson } from "@/lib/security";

type DbGlobal = typeof globalThis & { __telasJortPostgres?: Sql };

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL não configurada. Informe a conexão Session pooler do Supabase no EasyPanel.");
  const globals = globalThis as DbGlobal;
  globals.__telasJortPostgres ??= postgres(connectionString, {
    ssl: "require", max: 10, idle_timeout: 20, connect_timeout: 15, prepare: false,
  });
  return globals.__telasJortPostgres;
}

export async function checkDatabase() { await getDatabase()`select 1 as ok`; }

function iso(value: unknown) { return value instanceof Date ? value.toISOString() : String(value || ""); }
function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export type NewOrder = {
  customerAccountId: string; customer: Record<string, string>; subtotalCents: number; shippingCents: number;
  shippingService: string; shippingQuoteId?: string; discountCents?: number; couponCode?: string;
  items: Array<{ productId: string; sku: string; name: string; quantity: number; unitPriceCents: number; subtotalCents: number; weightKg: number; measurement?: unknown }>;
};

export async function createOrder(input: NewOrder) {
  const sql = getDatabase();
  const id = randomUUID();
  const publicNumber = `TJ${Date.now().toString().slice(-8)}`;
  const discountCents = Math.max(0, Math.min(input.discountCents || 0, input.subtotalCents));
  await sql.begin(async (tx) => {
    await tx`insert into public.orders (
      id, public_number, status, payment_status, fulfillment_status, subtotal_cents, shipping_cents,
      discount_cents, coupon_code, total_cents, customer_encrypted, shipping_service, shipping_quote_id, customer_account_id
    ) values (
      ${id}, ${publicNumber}, 'pending', 'pending', 'unfulfilled', ${input.subtotalCents}, ${input.shippingCents},
      ${discountCents}, ${input.couponCode || null}, ${Math.max(100, input.subtotalCents + input.shippingCents - discountCents)},
      ${encryptPrivateJson(input.customer)}, ${input.shippingService}, ${input.shippingQuoteId || null}, ${input.customerAccountId}
    )`;
    for (const item of input.items) {
      await tx`insert into public.order_items (
        id, order_id, product_id, sku, name, quantity, unit_price_cents, subtotal_cents, weight_kg, measurement_json
      ) values (
        ${randomUUID()}, ${id}, ${item.productId}, ${item.sku}, ${item.name}, ${item.quantity}, ${item.unitPriceCents},
        ${item.subtotalCents}, ${item.weightKg}, ${item.measurement ? tx.json(item.measurement as never) : null}
      )`;
    }
  });
  return { id, publicNumber };
}

function paymentOrderStatus(status: string) {
  const normalized = status.toLowerCase();
  if (["approved", "paid", "aprovado", "pago", "partially_refunded", "estorno_parcial"].includes(normalized)) return "paid";
  if (["rejected", "cancelled", "canceled", "recusado", "estornado", "refund", "refunded"].includes(normalized)) return "cancelled";
  return "pending";
}

export async function updateOrderPayment(orderId: string, status: string, providerId?: string, provider?: "mercado_pago" | "appmax") {
  const sql = getDatabase();
  await sql`update public.orders set status = ${paymentOrderStatus(status)}, payment_status = ${status},
    payment_provider_id = coalesce(${providerId || null}, payment_provider_id), payment_provider = coalesce(${provider || null}, payment_provider),
    updated_at = now() where id = ${orderId}`;
}

export async function updateOrderPaymentByPublicNumber(publicNumber: string, status: string, providerId?: string, provider?: "mercado_pago" | "appmax") {
  const sql = getDatabase();
  const rows = await sql<{ id: string }[]>`select id from public.orders where public_number = ${publicNumber} limit 1`;
  if (rows[0]) await updateOrderPayment(rows[0].id, status, providerId, provider);
}

export async function updateOrderPaymentByProviderId(providerId: string, status: string, provider?: "mercado_pago" | "appmax") {
  const sql = getDatabase();
  const rows = await sql<{ id: string }[]>`select id from public.orders where payment_provider_id = ${providerId} limit 1`;
  if (rows[0]) await updateOrderPayment(rows[0].id, status, providerId, provider);
}

export async function syncOrderRefundByPublicNumber(publicNumber: string, refundedCents?: number) {
  const sql = getDatabase();
  await sql.begin(async (tx) => {
    const rows = await tx<{ id: string; total_cents: number; refunded_cents: number }[]>`
      select id, total_cents, refunded_cents from public.orders where public_number = ${publicNumber} for update`;
    const order = rows[0];
    if (!order) return;
    const next = refundedCents === undefined ? Number(order.total_cents) : Math.max(Number(order.refunded_cents || 0), Math.min(Number(order.total_cents), refundedCents));
    const full = next >= Number(order.total_cents);
    await tx`update public.orders set refunded_cents = ${next}, payment_status = ${full ? "refunded" : "partially_refunded"},
      status = ${full ? "cancelled" : "paid"}, updated_at = now() where id = ${order.id}`;
  });
}

export type StoredOrder = {
  id: string; public_number: string; status: string; payment_status: string; fulfillment_status: string;
  subtotal_cents: number; shipping_cents: number; discount_cents: number; coupon_code: string | null; total_cents: number;
  customer: Record<string, string>; shipping_service: string; shipping_quote_id: string | null; payment_provider_id: string | null;
  payment_provider: "mercado_pago" | "appmax" | null; customer_account_id: string | null; refunded_cents: number;
  created_at: string; updated_at: string;
};
type StoredOrderRow = Omit<StoredOrder, "customer" | "created_at" | "updated_at"> & { customer_encrypted: string; created_at: unknown; updated_at: unknown };
function mapOrder(row: StoredOrderRow): StoredOrder {
  const { customer_encrypted, created_at, updated_at, ...order } = row;
  return { ...order, created_at: iso(created_at), updated_at: iso(updated_at), customer: decryptPrivateJson<Record<string, string>>(customer_encrypted) };
}

export async function listStoredOrders(limit = 30): Promise<StoredOrder[]> {
  const sql = getDatabase();
  const rows = await sql<StoredOrderRow[]>`select * from public.orders order by created_at desc limit ${Math.max(1, Math.min(limit, 5000))}`;
  return rows.map(mapOrder);
}
export async function getStoredOrderByPublicNumber(publicNumber: string): Promise<StoredOrder | null> {
  const rows = await getDatabase()<StoredOrderRow[]>`select * from public.orders where public_number = ${publicNumber} limit 1`;
  return rows[0] ? mapOrder(rows[0]) : null;
}
export async function getStoredOrderByProviderId(providerId: string): Promise<StoredOrder | null> {
  const rows = await getDatabase()<StoredOrderRow[]>`select * from public.orders where payment_provider_id = ${providerId} limit 1`;
  return rows[0] ? mapOrder(rows[0]) : null;
}
export async function getStoredOrderForCustomer(publicNumber: string, customerAccountId: string): Promise<StoredOrder | null> {
  const rows = await getDatabase()<StoredOrderRow[]>`select * from public.orders where public_number = ${publicNumber} and customer_account_id = ${customerAccountId} limit 1`;
  return rows[0] ? mapOrder(rows[0]) : null;
}
export async function listStoredOrdersForCustomer(customerAccountId: string, limit = 100): Promise<StoredOrder[]> {
  const rows = await getDatabase()<StoredOrderRow[]>`select * from public.orders where customer_account_id = ${customerAccountId} order by created_at desc limit ${Math.max(1, Math.min(limit, 500))}`;
  return rows.map(mapOrder);
}

export type StoredOrderItem = { product_id: string; sku: string; name: string; quantity: number; unit_price_cents: number; subtotal_cents: number; measurement: Record<string, number> | null };
export async function listStoredOrderItems(orderId: string): Promise<StoredOrderItem[]> {
  const rows = await getDatabase()<Array<Omit<StoredOrderItem, "measurement"> & { measurement_json: unknown }>>`
    select product_id, sku, name, quantity, unit_price_cents, subtotal_cents, measurement_json from public.order_items where order_id = ${orderId} order by id`;
  return rows.map(({ measurement_json, ...item }) => ({ ...item, measurement: parseJson<Record<string, number> | null>(measurement_json, null) }));
}

export type CustomerAccount = { id: string; name: string; email: string; phone: string; password_hash: string; created_at: string; updated_at: string };
type CustomerRow = Omit<CustomerAccount, "created_at" | "updated_at"> & { created_at: unknown; updated_at: unknown };
function mapCustomer(row: CustomerRow): CustomerAccount { return { ...row, created_at: iso(row.created_at), updated_at: iso(row.updated_at) }; }

export async function createCustomerAccount(input: { name: string; email: string; phone: string; passwordHash: string }) {
  const sql = getDatabase();
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  const rows = await sql<CustomerRow[]>`insert into public.customer_accounts (id, name, email, phone, password_hash)
    values (${id}, ${input.name.trim()}, ${email}, ${input.phone.trim()}, ${input.passwordHash}) returning *`;
  await audit(email, "customer.account_created", id);
  return mapCustomer(rows[0]);
}
export async function getCustomerAccountByEmail(email: string): Promise<CustomerAccount | null> {
  const rows = await getDatabase()<CustomerRow[]>`select * from public.customer_accounts where lower(email) = ${email.trim().toLowerCase()} limit 1`;
  return rows[0] ? mapCustomer(rows[0]) : null;
}
export async function getCustomerAccountById(id: string): Promise<CustomerAccount | null> {
  const rows = await getDatabase()<CustomerRow[]>`select * from public.customer_accounts where id = ${id} limit 1`;
  return rows[0] ? mapCustomer(rows[0]) : null;
}
export async function listCustomerAccounts(): Promise<Array<Omit<CustomerAccount, "password_hash">>> {
  const rows = await getDatabase()<Array<Omit<CustomerRow, "password_hash">>>`select id, name, email, phone, created_at, updated_at from public.customer_accounts order by created_at desc`;
  return rows.map((row) => ({ ...row, created_at: iso(row.created_at), updated_at: iso(row.updated_at) }));
}

export type RefundRequest = {
  id: string; order_id: string; requested_amount_cents: number; reason: string;
  status: "requested" | "processing" | "completed" | "failed" | "rejected"; provider: "mercado_pago" | "appmax" | null;
  provider_refund_id: string | null; requested_by: string; reviewed_by: string | null; failure_message: string | null;
  created_at: string; updated_at: string;
};
type RefundRow = Omit<RefundRequest, "created_at" | "updated_at"> & { created_at: unknown; updated_at: unknown };
function mapRefund(row: RefundRow): RefundRequest { return { ...row, created_at: iso(row.created_at), updated_at: iso(row.updated_at) }; }

export async function listRefundRequestsForOrder(orderId: string): Promise<RefundRequest[]> {
  const rows = await getDatabase()<RefundRow[]>`select * from public.refund_requests where order_id = ${orderId} order by created_at desc`;
  return rows.map(mapRefund);
}
export async function getRefundRequest(id: string): Promise<RefundRequest | null> {
  const rows = await getDatabase()<RefundRow[]>`select * from public.refund_requests where id = ${id} limit 1`;
  return rows[0] ? mapRefund(rows[0]) : null;
}
export async function createCustomerRefundRequest(input: { orderId: string; customerAccountId: string; reason: string }) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const orders = await tx<{ id: string; status: string; total_cents: number; refunded_cents: number }[]>`
      select id, status, total_cents, refunded_cents from public.orders where id = ${input.orderId} and customer_account_id = ${input.customerAccountId} for update`;
    const order = orders[0];
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "paid") throw new Error("Somente pedidos pagos podem receber solicitação de estorno.");
    const active = await tx<{ id: string }[]>`select id from public.refund_requests where order_id = ${order.id} and status in ('requested', 'processing') limit 1`;
    if (active[0]) throw new Error("Este pedido já possui uma solicitação de estorno em análise.");
    const amountCents = Math.max(0, Number(order.total_cents) - Number(order.refunded_cents || 0));
    if (amountCents < 1) throw new Error("Este pedido já foi totalmente estornado.");
    const rows = await tx<RefundRow[]>`insert into public.refund_requests (id, order_id, requested_amount_cents, reason, status, requested_by)
      values (${randomUUID()}, ${order.id}, ${amountCents}, ${input.reason.trim()}, 'requested', ${`customer:${input.customerAccountId}`}) returning *`;
    return mapRefund(rows[0]);
  });
}

export async function startAdminRefund(input: { requestId: string; orderId: string; amountCents: number; reason: string; provider: "mercado_pago" | "appmax"; actor: string }) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const existing = await tx<RefundRow[]>`select * from public.refund_requests where id = ${input.requestId} limit 1`;
    if (existing[0]) return { request: mapRefund(existing[0]), created: false };
    const orders = await tx<{ status: string; total_cents: number; refunded_cents: number }[]>`select status, total_cents, refunded_cents from public.orders where id = ${input.orderId} for update`;
    const order = orders[0];
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "paid") throw new Error("Somente pedidos pagos podem ser estornados.");
    const processing = await tx<{ id: string }[]>`select id from public.refund_requests where order_id = ${input.orderId} and status = 'processing' limit 1`;
    if (processing[0]) throw new Error("Já existe um estorno sendo processado para este pedido.");
    const availableCents = Number(order.total_cents) - Number(order.refunded_cents || 0);
    if (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > availableCents) throw new Error("O valor do estorno é inválido ou supera o saldo disponível.");
    const rows = await tx<RefundRow[]>`insert into public.refund_requests (id, order_id, requested_amount_cents, reason, status, provider, requested_by, reviewed_by)
      values (${input.requestId}, ${input.orderId}, ${input.amountCents}, ${input.reason.trim()}, 'processing', ${input.provider}, ${`admin:${input.actor}`}, ${input.actor}) returning *`;
    return { request: mapRefund(rows[0]), created: true };
  });
}

export async function completeAdminRefund(input: { requestId: string; providerRefundId?: string; actor: string }) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const requests = await tx<RefundRow[]>`select * from public.refund_requests where id = ${input.requestId} for update`;
    const request = requests[0];
    if (!request) throw new Error("Solicitação de estorno não encontrada.");
    if (request.status === "completed") return mapRefund(request);
    if (request.status !== "processing") throw new Error("Esta solicitação não está em processamento.");
    const orders = await tx<{ total_cents: number; refunded_cents: number }[]>`select total_cents, refunded_cents from public.orders where id = ${request.order_id} for update`;
    const order = orders[0];
    if (!order) throw new Error("Pedido não encontrado.");
    const refundedCents = Math.min(Number(order.total_cents), Number(order.refunded_cents || 0) + Number(request.requested_amount_cents));
    const full = refundedCents >= Number(order.total_cents);
    const completed = await tx<RefundRow[]>`update public.refund_requests set status = 'completed', provider_refund_id = ${input.providerRefundId || null},
      reviewed_by = ${input.actor}, failure_message = null, updated_at = now() where id = ${request.id} returning *`;
    await tx`update public.orders set refunded_cents = ${refundedCents}, payment_status = ${full ? "refunded" : "partially_refunded"},
      status = ${full ? "cancelled" : "paid"}, updated_at = now() where id = ${request.order_id}`;
    await tx`update public.refund_requests set status = 'completed', reviewed_by = ${input.actor}, failure_message = null, updated_at = now()
      where order_id = ${request.order_id} and requested_by like 'customer:%' and status in ('requested', 'processing')`;
    return mapRefund(completed[0]);
  });
}
export async function failAdminRefund(input: { requestId: string; message: string; actor: string }) {
  await getDatabase()`update public.refund_requests set status = 'failed', reviewed_by = ${input.actor}, failure_message = ${input.message.slice(0, 500)}, updated_at = now()
    where id = ${input.requestId} and status = 'processing'`;
}
export async function updateCustomerRefundRequest(input: { requestId?: string; orderId: string; status: "processing" | "completed" | "failed" | "rejected"; actor: string; message?: string }) {
  if (!input.requestId) return;
  await getDatabase()`update public.refund_requests set status = ${input.status}, reviewed_by = ${input.actor}, failure_message = ${input.message?.slice(0, 500) || null}, updated_at = now()
    where id = ${input.requestId} and order_id = ${input.orderId} and status = 'requested'`;
}
export async function completeProcessingRefundForOrder(orderId: string, actor = "webhook") {
  const rows = await getDatabase()<{ id: string }[]>`select id from public.refund_requests where order_id = ${orderId} and status = 'processing' order by created_at asc limit 1`;
  return rows[0] ? completeAdminRefund({ requestId: rows[0].id, actor }) : null;
}

export async function heartbeatVisitor(input: { visitorId: string; ipHash: string; path: string; device: string }) {
  const sql = getDatabase();
  const rows = await sql<{ path: string; last_seen_at: unknown }[]>`select path, last_seen_at from public.visitor_sessions where visitor_id = ${input.visitorId} limit 1`;
  const previous = rows[0];
  await sql`insert into public.visitor_sessions (visitor_id, ip_hash, path, device) values (${input.visitorId}, ${input.ipHash}, ${input.path}, ${input.device})
    on conflict (visitor_id) do update set path = excluded.path, device = excluded.device, last_seen_at = now()`;
  const expired = !previous?.last_seen_at || Date.now() - new Date(iso(previous.last_seen_at)).getTime() > 30 * 60_000;
  if (!previous || previous.path !== input.path || expired) await recordAnalyticsEvent(input.visitorId, "page_view", input.path);
}
export async function getLiveVisitors() {
  const rows = await getDatabase()<Array<{ visitor_id: string; path: string; device: string; first_seen_at: unknown; last_seen_at: unknown }>>`
    select visitor_id, path, device, first_seen_at, last_seen_at from public.visitor_sessions where last_seen_at >= now() - interval '90 seconds' order by last_seen_at desc`;
  return rows.map((row) => ({ ...row, first_seen_at: iso(row.first_seen_at), last_seen_at: iso(row.last_seen_at) }));
}
export async function recordAnalyticsEvent(visitorId: string, event: string, pagePath: string, metadata?: unknown) {
  const sql = getDatabase();
  await sql`insert into public.analytics_events (id, visitor_id, event, path, metadata_json)
    values (${randomUUID()}, ${visitorId}, ${event}, ${pagePath}, ${metadata ? sql.json(metadata as never) : null})`;
}

type DatedValue = { created_at: string; total_cents?: number; visitor_id?: string; path?: string; event?: string };
const shortDay = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" });
function dayKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(date); }
function monthKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date); }
function startOfRange(days: number) { return new Date(Date.now() - days * 86_400_000).toISOString(); }

export async function getAdminAnalytics() {
  const sql = getDatabase();
  const [orderRows, eventRows, todayRows, visitorRowsRaw] = await Promise.all([
    sql<Array<{ total_cents: number; created_at: unknown }>>`select total_cents, created_at from public.orders where status = 'paid' and created_at >= ${startOfRange(370)} order by created_at`,
    sql<Array<{ visitor_id: string; event: string; path: string; created_at: unknown }>>`select visitor_id, event, path, created_at from public.analytics_events where created_at >= ${startOfRange(370)} order by created_at`,
    sql<Array<{ total_cents: number; status: string; created_at: unknown }>>`select total_cents, status, created_at from public.orders where created_at >= ${startOfRange(2)}`,
    sql<Array<{ first_seen_at: unknown; last_seen_at: unknown }>>`select first_seen_at, last_seen_at from public.visitor_sessions where last_seen_at >= ${startOfRange(7)}`,
  ]);
  const orders: DatedValue[] = orderRows.map((row) => ({ ...row, created_at: iso(row.created_at) }));
  const events: DatedValue[] = eventRows.map((row) => ({ ...row, created_at: iso(row.created_at) }));
  const allTodayOrders = todayRows.map((row) => ({ ...row, created_at: iso(row.created_at) }));
  const now = new Date(), todayKey = dayKey(now);
  const paidToday = allTodayOrders.filter((row) => row.status === "paid" && dayKey(new Date(row.created_at)) === todayKey);
  const ordersToday = allTodayOrders.filter((row) => dayKey(new Date(row.created_at)) === todayKey).length;
  const pageViewsToday = events.filter((event) => event.event === "page_view" && dayKey(new Date(event.created_at)) === todayKey);
  const visitorsToday = new Set(pageViewsToday.map((event) => event.visitor_id)).size;
  const revenueTodayCents = paidToday.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
  const conversion = visitorsToday ? ordersToday / visitorsToday * 100 : 0;
  const ticketAverageCents = paidToday.length ? Math.round(revenueTodayCents / paidToday.length) : 0;
  const makeDaily = (days: number) => Array.from({ length: days }, (_, index) => { const date = new Date(Date.now() - (days - 1 - index) * 86_400_000); const key = dayKey(date); return { label: days <= 7 ? shortDay.format(date).replace(".", "") : shortDate.format(date), value: orders.filter((row) => dayKey(new Date(row.created_at)) === key).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) }; });
  const today = Array.from({ length: 8 }, (_, index) => { const hour = index * 3; return { label: `${String(hour).padStart(2, "0")}h`, value: orders.filter((row) => { const date = new Date(row.created_at); const currentHour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(date)); return dayKey(date) === todayKey && currentHour >= hour && currentHour < hour + 3; }).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) }; });
  const year = Array.from({ length: 12 }, (_, index) => { const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 15)); const key = monthKey(date); return { label: monthName.format(date).replace(".", ""), value: orders.filter((row) => monthKey(new Date(row.created_at)) === key).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) }; });
  const accessData = Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() - (6 - index) * 86_400_000); const key = dayKey(date); const views = events.filter((event) => event.event === "page_view" && dayKey(new Date(event.created_at)) === key); return { label: shortDay.format(date).replace(".", ""), sessions: views.length, visitors: new Set(views.map((event) => event.visitor_id)).size }; });
  const sevenDays = events.filter((event) => new Date(event.created_at).getTime() >= Date.now() - 7 * 86_400_000);
  const pageViews = sevenDays.filter((event) => event.event === "page_view");
  const pageCounts = new Map<string, number>();
  for (const event of pageViews) pageCounts.set(String(event.path), (pageCounts.get(String(event.path)) || 0) + 1);
  const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, views]) => ({ path, views }));
  const visitorRows = visitorRowsRaw.map((row) => ({ first_seen_at: iso(row.first_seen_at), last_seen_at: iso(row.last_seen_at) }));
  const averageSeconds = visitorRows.length ? Math.round(visitorRows.reduce((sum, row) => sum + Math.max(0, (new Date(row.last_seen_at).getTime() - new Date(row.first_seen_at).getTime()) / 1000), 0) / visitorRows.length) : 0;
  return { dashboard: { revenueTodayCents, ordersToday, visitorsToday, conversion, ticketAverageCents }, sales: { today, week: makeDaily(7), month: makeDaily(30), year }, accessData,
    overview: { accesses: pageViews.length, visitors: new Set(pageViews.map((event) => event.visitor_id)).size, addedToCart: sevenDays.filter((event) => event.event === "add_to_cart").length, checkoutStarted: sevenDays.filter((event) => event.event === "begin_checkout").length, purchases: sevenDays.filter((event) => event.event === "purchase").length, averageSeconds }, topPages };
}

export async function startWebhook(provider: string, eventId: string) {
  const rows = await getDatabase()<{ provider: string }[]>`insert into public.webhook_events (provider, provider_event_id, status)
    values (${provider}, ${eventId}, 'received') on conflict do nothing returning provider`;
  return rows.length === 1;
}
export async function finishWebhook(provider: string, eventId: string, status: string) {
  await getDatabase()`update public.webhook_events set status = ${status}, processed_at = now() where provider = ${provider} and provider_event_id = ${eventId}`;
}
export async function audit(actor: string, action: string, target?: string, metadata?: unknown) {
  const sql = getDatabase();
  await sql`insert into public.audit_logs (id, actor, action, target, metadata_json) values (${randomUUID()}, ${actor}, ${action}, ${target || null}, ${metadata ? sql.json(metadata as never) : null})`;
}
export async function saveProductConfig(productId: string, config: unknown, actor: string) {
  const sql = getDatabase();
  await sql`insert into public.product_configs (product_id, config_json, updated_by) values (${productId}, ${sql.json(config as never)}, ${actor})
    on conflict (product_id) do update set config_json = excluded.config_json, updated_by = excluded.updated_by, updated_at = now()`;
  await audit(actor, "product.config_saved", productId);
}
export async function listProductConfigs() {
  const rows = await getDatabase()<Array<{ product_id: string; config_json: unknown }>>`select product_id, config_json from public.product_configs order by product_id`;
  return rows.map((row) => ({ productId: row.product_id, config: parseJson<Record<string, unknown>>(row.config_json, {}) }));
}
export async function getStoredStoreSettings() {
  const rows = await getDatabase()<Array<{ config_json: unknown }>>`select config_json from public.store_settings where id = 'store' limit 1`;
  return rows[0] ? parseJson<Record<string, unknown>>(rows[0].config_json, {}) : null;
}
export async function saveStoreSettings(config: unknown, actor: string) {
  const sql = getDatabase();
  await sql`insert into public.store_settings (id, config_json, updated_by) values ('store', ${sql.json(config as never)}, ${actor})
    on conflict (id) do update set config_json = excluded.config_json, updated_by = excluded.updated_by, updated_at = now()`;
  await audit(actor, "store.settings_saved", "store");
}

export type Coupon = { code: string; kind: "percentage" | "fixed"; value: number; minimumCents: number; expiresAt: string | null; active: boolean; createdAt: string; updatedAt: string };
type CouponRow = { code: string; kind: "percentage" | "fixed"; value: number; minimum_cents: number; expires_at: unknown | null; active: boolean; created_at: unknown; updated_at: unknown };
function mapCoupon(row: CouponRow): Coupon { return { code: row.code, kind: row.kind, value: Number(row.value), minimumCents: Number(row.minimum_cents), expiresAt: row.expires_at ? iso(row.expires_at) : null, active: Boolean(row.active), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }; }
export async function listCoupons(): Promise<Coupon[]> { return (await getDatabase()<CouponRow[]>`select * from public.coupons order by active desc, created_at desc`).map(mapCoupon); }
export async function saveCoupon(input: { code: string; kind: "percentage" | "fixed"; value: number; minimumCents: number; expiresAt: string | null; active: boolean }, actor: string) {
  const sql = getDatabase(), code = input.code.trim().toUpperCase();
  const rows = await sql<CouponRow[]>`insert into public.coupons (code, kind, value, minimum_cents, expires_at, active)
    values (${code}, ${input.kind}, ${input.value}, ${input.minimumCents}, ${input.expiresAt}, ${input.active}) on conflict (code) do update set
    kind = excluded.kind, value = excluded.value, minimum_cents = excluded.minimum_cents, expires_at = excluded.expires_at, active = excluded.active, updated_at = now() returning *`;
  await audit(actor, "coupon.saved", code, { kind: input.kind, value: input.value, active: input.active });
  return mapCoupon(rows[0]);
}
export async function getCoupon(code: string): Promise<Coupon | null> {
  const rows = await getDatabase()<CouponRow[]>`select * from public.coupons where code = ${code.trim().toUpperCase()} limit 1`;
  return rows[0] ? mapCoupon(rows[0]) : null;
}
export async function deleteCoupon(code: string, actor: string) { const normalized = code.trim().toUpperCase(); await getDatabase()`delete from public.coupons where code = ${normalized}`; await audit(actor, "coupon.deleted", normalized); }
export async function validateCoupon(code: string, subtotalCents: number) {
  const coupon = await getCoupon(code);
  if (!coupon || !coupon.active) return { valid: false as const, message: "Cupom inválido ou desativado." };
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return { valid: false as const, message: "Este cupom expirou." };
  if (subtotalCents < coupon.minimumCents) return { valid: false as const, message: `Este cupom exige uma compra mínima de R$ ${(coupon.minimumCents / 100).toFixed(2).replace(".", ",")}.` };
  const discountCents = coupon.kind === "percentage" ? Math.round(subtotalCents * Math.min(coupon.value, 100) / 100) : Math.min(coupon.value, subtotalCents);
  return { valid: true as const, coupon, discountCents, message: "Cupom aplicado." };
}

export type FiscalDocument = { id: string; order_id: string; provider: string; provider_reference: string; status: "queued" | "processing" | "authorized" | "error" | "cancelled"; access_key: string | null; number: string | null; series: string | null; danfe_url: string | null; xml_url: string | null; error_message: string | null; issued_at: string | null; created_at: string; updated_at: string };
type FiscalRow = Omit<FiscalDocument, "issued_at" | "created_at" | "updated_at"> & { issued_at: unknown | null; created_at: unknown; updated_at: unknown };
function mapFiscal(row: FiscalRow): FiscalDocument { return { ...row, issued_at: row.issued_at ? iso(row.issued_at) : null, created_at: iso(row.created_at), updated_at: iso(row.updated_at) }; }
export async function getFiscalDocumentForOrder(orderId: string): Promise<FiscalDocument | null> { const rows = await getDatabase()<FiscalRow[]>`select * from public.fiscal_documents where order_id = ${orderId} limit 1`; return rows[0] ? mapFiscal(rows[0]) : null; }
export async function getFiscalDocumentByReference(reference: string): Promise<FiscalDocument | null> { const rows = await getDatabase()<FiscalRow[]>`select * from public.fiscal_documents where provider_reference = ${reference} limit 1`; return rows[0] ? mapFiscal(rows[0]) : null; }
export async function beginFiscalDocument(orderId: string, reference: string) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const rows = await tx<FiscalRow[]>`select * from public.fiscal_documents where order_id = ${orderId} for update`;
    const existing = rows[0];
    if (existing && ["queued", "processing", "authorized", "cancelled"].includes(existing.status)) return { document: mapFiscal(existing), started: false };
    const updated = existing
      ? await tx<FiscalRow[]>`update public.fiscal_documents set status = 'queued', error_message = null, updated_at = now() where id = ${existing.id} returning *`
      : await tx<FiscalRow[]>`insert into public.fiscal_documents (id, order_id, provider, provider_reference, status) values (${randomUUID()}, ${orderId}, 'focus_nfe', ${reference}, 'queued') returning *`;
    return { document: mapFiscal(updated[0]), started: true };
  });
}
export async function updateFiscalDocument(reference: string, input: { status: FiscalDocument["status"]; accessKey?: string | null; number?: string | null; series?: string | null; danfeUrl?: string | null; xmlUrl?: string | null; errorMessage?: string | null }) {
  await getDatabase()`update public.fiscal_documents set status = ${input.status}, access_key = coalesce(${input.accessKey ?? null}, access_key),
    number = coalesce(${input.number ?? null}, number), series = coalesce(${input.series ?? null}, series), danfe_url = coalesce(${input.danfeUrl ?? null}, danfe_url),
    xml_url = coalesce(${input.xmlUrl ?? null}, xml_url), error_message = ${input.errorMessage ?? null},
    issued_at = case when ${input.status} = 'authorized' then coalesce(issued_at, now()) else issued_at end, updated_at = now() where provider_reference = ${reference}`;
}

export const integrationProviders = ["mercado_pago", "appmax", "melhor_envio", "google_merchant", "carrier_direct", "mercado_livre", "shopee", "meta_conversions", "google_ads", "focus_nfe"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];
export type IntegrationConfig = { provider: IntegrationProvider; enabled: boolean; environment: "sandbox" | "production"; publicConfig: Record<string, string>; secrets: Record<string, string>; secretKeys: string[]; lastTestStatus: "success" | "failed" | null; lastTestMessage: string | null; lastTestedAt: string | null; updatedAt: string | null };
type IntegrationRow = { provider: IntegrationProvider; enabled: boolean; environment: "sandbox" | "production"; public_config_json: unknown; secret_config_encrypted: string | null; last_test_status: "success" | "failed" | null; last_test_message: string | null; last_tested_at: unknown | null; updated_at: unknown };
function parseJsonRecord(value: unknown) { const parsed = parseJson<Record<string, unknown>>(value, {}); return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")); }
function mapIntegrationRow(row: IntegrationRow): IntegrationConfig {
  const secrets = row.secret_config_encrypted ? decryptPrivateJson<Record<string, string>>(row.secret_config_encrypted) : {};
  return { provider: row.provider, enabled: Boolean(row.enabled), environment: row.environment, publicConfig: parseJsonRecord(row.public_config_json), secrets,
    secretKeys: Object.keys(secrets).filter((key) => Boolean(secrets[key])), lastTestStatus: row.last_test_status, lastTestMessage: row.last_test_message,
    lastTestedAt: row.last_tested_at ? iso(row.last_tested_at) : null, updatedAt: iso(row.updated_at) };
}
export async function getIntegrationConfig(provider: IntegrationProvider): Promise<IntegrationConfig | null> { const rows = await getDatabase()<IntegrationRow[]>`select * from public.integration_configs where provider = ${provider} limit 1`; return rows[0] ? mapIntegrationRow(rows[0]) : null; }
export async function listIntegrationConfigs() {
  const rows = await getDatabase()<IntegrationRow[]>`select * from public.integration_configs order by provider`;
  const byProvider = new Map(rows.map((row) => [row.provider, mapIntegrationRow(row)]));
  return integrationProviders.map((provider): IntegrationConfig => byProvider.get(provider) || { provider, enabled: false, environment: "sandbox", publicConfig: {}, secrets: {}, secretKeys: [], lastTestStatus: null, lastTestMessage: null, lastTestedAt: null, updatedAt: null });
}
export async function saveIntegrationConfig(input: { provider: IntegrationProvider; enabled: boolean; environment: "sandbox" | "production"; publicConfig: Record<string, string>; secrets: Record<string, string> }, actor: string) {
  const sql = getDatabase(), existing = await getIntegrationConfig(input.provider);
  const suppliedSecrets = Object.fromEntries(Object.entries(input.secrets).filter(([, value]) => value.trim().length > 0));
  const mergedSecrets = { ...(existing?.secrets || {}), ...suppliedSecrets };
  const changed = !existing || existing.environment !== input.environment || JSON.stringify(existing.publicConfig) !== JSON.stringify(input.publicConfig) || Object.keys(suppliedSecrets).length > 0;
  await sql.begin(async (tx) => {
    if (input.enabled && (input.provider === "mercado_pago" || input.provider === "appmax")) await tx`update public.integration_configs set enabled = false, updated_at = now() where provider in ('mercado_pago', 'appmax') and provider <> ${input.provider}`;
    await tx`insert into public.integration_configs (provider, enabled, environment, public_config_json, secret_config_encrypted, last_test_status, last_test_message, last_tested_at, updated_by)
      values (${input.provider}, ${input.enabled}, ${input.environment}, ${tx.json(input.publicConfig as never)}, ${Object.keys(mergedSecrets).length ? encryptPrivateJson(mergedSecrets) : null},
        ${changed ? null : existing?.lastTestStatus || null}, ${changed ? null : existing?.lastTestMessage || null}, ${changed ? null : existing?.lastTestedAt || null}, ${actor})
      on conflict (provider) do update set enabled = excluded.enabled, environment = excluded.environment, public_config_json = excluded.public_config_json,
        secret_config_encrypted = excluded.secret_config_encrypted, last_test_status = excluded.last_test_status, last_test_message = excluded.last_test_message,
        last_tested_at = excluded.last_tested_at, updated_by = excluded.updated_by, updated_at = now()`;
  });
  await audit(actor, "integration.config_saved", input.provider, { enabled: input.enabled, environment: input.environment, publicFields: Object.keys(input.publicConfig), secretFieldsUpdated: Object.keys(suppliedSecrets) });
}
export async function saveIntegrationTest(provider: IntegrationProvider, status: "success" | "failed", message: string, actor: string) {
  await getDatabase()`update public.integration_configs set last_test_status = ${status}, last_test_message = ${message.slice(0, 300)}, last_tested_at = now(), updated_by = ${actor}, updated_at = now() where provider = ${provider}`;
  await audit(actor, `integration.test_${status}`, provider);
}

import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { decryptPrivateJson, encryptPrivateJson } from "@/lib/security";

type DbGlobal = typeof globalThis & { __telasJortDb?: DatabaseSync };

function openDatabase() {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "telas-jort.sqlite");
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, public_number TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
      payment_status TEXT NOT NULL, fulfillment_status TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
      customer_encrypted TEXT NOT NULL, shipping_service TEXT NOT NULL, shipping_quote_id TEXT,
      payment_provider_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS customer_accounts_email_idx ON customer_accounts(email);
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL, weight_kg REAL NOT NULL,
      measurement_json TEXT
    );
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      visitor_id TEXT PRIMARY KEY, ip_hash TEXT NOT NULL, path TEXT NOT NULL, device TEXT NOT NULL,
      first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON visitor_sessions(last_seen_at);
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, event TEXT NOT NULL, path TEXT NOT NULL,
      metadata_json TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON analytics_events(created_at);
    CREATE TABLE IF NOT EXISTS webhook_events (
      provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, status TEXT NOT NULL,
      received_at TEXT NOT NULL, processed_at TEXT, PRIMARY KEY(provider, provider_event_id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT,
      metadata_json TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_configs (
      product_id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS integration_configs (
      provider TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      environment TEXT NOT NULL DEFAULT 'sandbox',
      public_config_json TEXT NOT NULL DEFAULT '{}',
      secret_config_encrypted TEXT,
      last_test_status TEXT,
      last_test_message TEXT,
      last_tested_at TEXT,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      value INTEGER NOT NULL,
      minimum_cents INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      requested_amount_cents INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      provider_refund_id TEXT,
      requested_by TEXT NOT NULL,
      reviewed_by TEXT,
      failure_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS refund_requests_order_idx ON refund_requests(order_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS fiscal_documents (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_reference TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      access_key TEXT,
      number TEXT,
      series TEXT,
      danfe_url TEXT,
      xml_url TEXT,
      error_message TEXT,
      issued_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fiscal_documents_status_idx ON fiscal_documents(status, updated_at DESC);
  `);
  const orderColumns = new Set((db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>).map((column) => column.name));
  if (!orderColumns.has("discount_cents")) db.exec("ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0");
  if (!orderColumns.has("coupon_code")) db.exec("ALTER TABLE orders ADD COLUMN coupon_code TEXT");
  if (!orderColumns.has("customer_account_id")) db.exec("ALTER TABLE orders ADD COLUMN customer_account_id TEXT REFERENCES customer_accounts(id)");
  if (!orderColumns.has("payment_provider")) db.exec("ALTER TABLE orders ADD COLUMN payment_provider TEXT");
  if (!orderColumns.has("refunded_cents")) db.exec("ALTER TABLE orders ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE INDEX IF NOT EXISTS orders_customer_account_idx ON orders(customer_account_id, created_at DESC)");
  return db;
}

export function getDatabase() {
  const globals = globalThis as DbGlobal;
  globals.__telasJortDb ??= openDatabase();
  return globals.__telasJortDb;
}

export type NewOrder = {
  customerAccountId: string;
  customer: Record<string, string>;
  subtotalCents: number;
  shippingCents: number;
  shippingService: string;
  shippingQuoteId?: string;
  discountCents?: number;
  couponCode?: string;
  items: Array<{ productId: string; sku: string; name: string; quantity: number; unitPriceCents: number; subtotalCents: number; weightKg: number; measurement?: unknown }>;
};

export function createOrder(input: NewOrder) {
  const db = getDatabase();
  const id = randomUUID();
  const publicNumber = `TJ${Date.now().toString().slice(-8)}`;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const discountCents = Math.max(0, Math.min(input.discountCents || 0, input.subtotalCents));
    db.prepare(`INSERT INTO orders (id, public_number, status, payment_status, fulfillment_status, subtotal_cents, shipping_cents, discount_cents, coupon_code, total_cents, customer_encrypted, shipping_service, shipping_quote_id, customer_account_id, created_at, updated_at) VALUES (?, ?, 'pending', 'pending', 'unfulfilled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, publicNumber, input.subtotalCents, input.shippingCents, discountCents, input.couponCode || null, input.subtotalCents + input.shippingCents - discountCents, encryptPrivateJson(input.customer), input.shippingService, input.shippingQuoteId || null, input.customerAccountId, now, now);
    const insertItem = db.prepare(`INSERT INTO order_items (id, order_id, product_id, sku, name, quantity, unit_price_cents, subtotal_cents, weight_kg, measurement_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of input.items) insertItem.run(randomUUID(), id, item.productId, item.sku, item.name, item.quantity, item.unitPriceCents, item.subtotalCents, item.weightKg, item.measurement ? JSON.stringify(item.measurement) : null);
    db.exec("COMMIT");
    return { id, publicNumber };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

export function updateOrderPayment(orderId: string, status: string, providerId?: string, provider?: "mercado_pago" | "appmax") {
  const normalized = status.toLowerCase();
  const orderStatus = ["approved", "paid", "aprovado", "pago", "partially_refunded", "estorno_parcial"].includes(normalized)
    ? "paid"
    : ["rejected", "cancelled", "canceled", "recusado", "estornado", "refund", "refunded"].includes(normalized)
      ? "cancelled"
      : "pending";
  getDatabase().prepare("UPDATE orders SET status = ?, payment_status = ?, payment_provider_id = COALESCE(?, payment_provider_id), payment_provider = COALESCE(?, payment_provider), updated_at = ? WHERE id = ?")
    .run(orderStatus, status, providerId || null, provider || null, new Date().toISOString(), orderId);
}

export function updateOrderPaymentByPublicNumber(publicNumber: string, status: string, providerId?: string, provider?: "mercado_pago" | "appmax") {
  const row = getDatabase().prepare("SELECT id FROM orders WHERE public_number = ?").get(publicNumber) as { id?: string } | undefined;
  if (row?.id) updateOrderPayment(row.id, status, providerId, provider);
}

export function updateOrderPaymentByProviderId(providerId: string, status: string, provider?: "mercado_pago" | "appmax") {
  const row = getDatabase().prepare("SELECT id FROM orders WHERE payment_provider_id = ?").get(providerId) as { id?: string } | undefined;
  if (row?.id) updateOrderPayment(row.id, status, providerId, provider);
}

export function syncOrderRefundByPublicNumber(publicNumber: string, refundedCents?: number) {
  const db = getDatabase();
  const order = db.prepare("SELECT id, total_cents, refunded_cents FROM orders WHERE public_number = ?").get(publicNumber) as { id: string; total_cents: number; refunded_cents: number } | undefined;
  if (!order) return;
  const next = refundedCents === undefined ? Number(order.total_cents) : Math.max(Number(order.refunded_cents || 0), Math.min(Number(order.total_cents), refundedCents));
  const full = next >= Number(order.total_cents);
  db.prepare("UPDATE orders SET refunded_cents = ?, payment_status = ?, status = ?, updated_at = ? WHERE id = ?")
    .run(next, full ? "refunded" : "partially_refunded", full ? "cancelled" : "paid", new Date().toISOString(), order.id);
}

export type StoredOrder = {
  id: string;
  public_number: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  coupon_code: string | null;
  total_cents: number;
  customer: Record<string, string>;
  shipping_service: string;
  shipping_quote_id: string | null;
  payment_provider_id: string | null;
  payment_provider: "mercado_pago" | "appmax" | null;
  customer_account_id: string | null;
  refunded_cents: number;
  created_at: string;
  updated_at: string;
};

type StoredOrderRow = Omit<StoredOrder, "customer"> & { customer_encrypted: string };

export function listStoredOrders(limit = 30): StoredOrder[] {
  const rows = getDatabase().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?").all(Math.max(1, Math.min(limit, 5000))) as StoredOrderRow[];
  return rows.map(({ customer_encrypted, ...row }) => ({
    ...row,
    customer: decryptPrivateJson<Record<string, string>>(customer_encrypted),
  }));
}

export function getStoredOrderByPublicNumber(publicNumber: string): StoredOrder | null {
  const row = getDatabase().prepare("SELECT * FROM orders WHERE public_number = ?").get(publicNumber) as StoredOrderRow | undefined;
  if (!row) return null;
  const { customer_encrypted, ...order } = row;
  return { ...order, customer: decryptPrivateJson<Record<string, string>>(customer_encrypted) };
}

export function getStoredOrderByProviderId(providerId: string): StoredOrder | null {
  const row = getDatabase().prepare("SELECT * FROM orders WHERE payment_provider_id = ?").get(providerId) as StoredOrderRow | undefined;
  if (!row) return null;
  const { customer_encrypted, ...order } = row;
  return { ...order, customer: decryptPrivateJson<Record<string, string>>(customer_encrypted) };
}

export function getStoredOrderForCustomer(publicNumber: string, customerAccountId: string): StoredOrder | null {
  const row = getDatabase().prepare("SELECT * FROM orders WHERE public_number = ? AND customer_account_id = ?").get(publicNumber, customerAccountId) as StoredOrderRow | undefined;
  if (!row) return null;
  const { customer_encrypted, ...order } = row;
  return { ...order, customer: decryptPrivateJson<Record<string, string>>(customer_encrypted) };
}

export function listStoredOrdersForCustomer(customerAccountId: string, limit = 100): StoredOrder[] {
  const rows = getDatabase().prepare("SELECT * FROM orders WHERE customer_account_id = ? ORDER BY created_at DESC LIMIT ?").all(customerAccountId, Math.max(1, Math.min(limit, 500))) as StoredOrderRow[];
  return rows.map(({ customer_encrypted, ...row }) => ({ ...row, customer: decryptPrivateJson<Record<string, string>>(customer_encrypted) }));
}

export type StoredOrderItem = { product_id: string; sku: string; name: string; quantity: number; unit_price_cents: number; subtotal_cents: number; measurement: Record<string, number> | null };

export function listStoredOrderItems(orderId: string): StoredOrderItem[] {
  const rows = getDatabase().prepare("SELECT product_id, sku, name, quantity, unit_price_cents, subtotal_cents, measurement_json FROM order_items WHERE order_id = ? ORDER BY rowid").all(orderId) as Array<Omit<StoredOrderItem, "measurement"> & { measurement_json: string | null }>;
  return rows.map(({ measurement_json, ...item }) => {
    let measurement: Record<string, number> | null = null;
    try { measurement = measurement_json ? JSON.parse(measurement_json) as Record<string, number> : null; } catch { measurement = null; }
    return { ...item, measurement };
  });
}

export type CustomerAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export function createCustomerAccount(input: { name: string; email: string; phone: string; passwordHash: string }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDatabase().prepare("INSERT INTO customer_accounts (id, name, email, phone, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.name.trim(), input.email.trim().toLowerCase(), input.phone.trim(), input.passwordHash, now, now);
  audit(input.email.trim().toLowerCase(), "customer.account_created", id);
  return getCustomerAccountById(id)!;
}

export function getCustomerAccountByEmail(email: string): CustomerAccount | null {
  return (getDatabase().prepare("SELECT * FROM customer_accounts WHERE email = ? COLLATE NOCASE").get(email.trim().toLowerCase()) as CustomerAccount | undefined) || null;
}

export function getCustomerAccountById(id: string): CustomerAccount | null {
  return (getDatabase().prepare("SELECT * FROM customer_accounts WHERE id = ?").get(id) as CustomerAccount | undefined) || null;
}

export function listCustomerAccounts(): Array<Omit<CustomerAccount, "password_hash">> {
  return getDatabase().prepare("SELECT id, name, email, phone, created_at, updated_at FROM customer_accounts ORDER BY created_at DESC").all() as Array<Omit<CustomerAccount, "password_hash">>;
}

export type RefundRequest = {
  id: string;
  order_id: string;
  requested_amount_cents: number;
  reason: string;
  status: "requested" | "processing" | "completed" | "failed" | "rejected";
  provider: "mercado_pago" | "appmax" | null;
  provider_refund_id: string | null;
  requested_by: string;
  reviewed_by: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

export function listRefundRequestsForOrder(orderId: string): RefundRequest[] {
  return getDatabase().prepare("SELECT * FROM refund_requests WHERE order_id = ? ORDER BY created_at DESC").all(orderId) as RefundRequest[];
}

export function getRefundRequest(id: string): RefundRequest | null {
  return (getDatabase().prepare("SELECT * FROM refund_requests WHERE id = ?").get(id) as RefundRequest | undefined) || null;
}

export function createCustomerRefundRequest(input: { orderId: string; customerAccountId: string; reason: string }) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = db.prepare("SELECT id, status, total_cents, refunded_cents FROM orders WHERE id = ? AND customer_account_id = ?").get(input.orderId, input.customerAccountId) as { id: string; status: string; total_cents: number; refunded_cents: number } | undefined;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "paid") throw new Error("Somente pedidos pagos podem receber solicitação de estorno.");
    const active = db.prepare("SELECT id FROM refund_requests WHERE order_id = ? AND status IN ('requested', 'processing') LIMIT 1").get(order.id) as { id?: string } | undefined;
    if (active?.id) throw new Error("Este pedido já possui uma solicitação de estorno em análise.");
    const amountCents = Math.max(0, Number(order.total_cents) - Number(order.refunded_cents || 0));
    if (amountCents < 1) throw new Error("Este pedido já foi totalmente estornado.");
    const id = randomUUID();
    db.prepare("INSERT INTO refund_requests (id, order_id, requested_amount_cents, reason, status, requested_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'requested', ?, ?, ?)")
      .run(id, order.id, amountCents, input.reason.trim(), `customer:${input.customerAccountId}`, now, now);
    db.exec("COMMIT");
    return getRefundRequest(id)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function startAdminRefund(input: {
  requestId: string;
  orderId: string;
  amountCents: number;
  reason: string;
  provider: "mercado_pago" | "appmax";
  actor: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare("SELECT * FROM refund_requests WHERE id = ?").get(input.requestId) as RefundRequest | undefined;
    if (existing) {
      db.exec("COMMIT");
      return { request: existing, created: false };
    }
    const order = db.prepare("SELECT status, total_cents, refunded_cents FROM orders WHERE id = ?").get(input.orderId) as { status: string; total_cents: number; refunded_cents: number } | undefined;
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "paid") throw new Error("Somente pedidos pagos podem ser estornados.");
    const processing = db.prepare("SELECT id FROM refund_requests WHERE order_id = ? AND status = 'processing' LIMIT 1").get(input.orderId) as { id?: string } | undefined;
    if (processing?.id) throw new Error("Já existe um estorno sendo processado para este pedido.");
    const availableCents = Number(order.total_cents) - Number(order.refunded_cents || 0);
    if (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > availableCents) throw new Error("O valor do estorno é inválido ou supera o saldo disponível.");
    db.prepare("INSERT INTO refund_requests (id, order_id, requested_amount_cents, reason, status, provider, requested_by, reviewed_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?)")
      .run(input.requestId, input.orderId, input.amountCents, input.reason.trim(), input.provider, `admin:${input.actor}`, input.actor, now, now);
    db.exec("COMMIT");
    return { request: getRefundRequest(input.requestId)!, created: true };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function completeAdminRefund(input: { requestId: string; providerRefundId?: string; actor: string }) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const request = db.prepare("SELECT * FROM refund_requests WHERE id = ?").get(input.requestId) as RefundRequest | undefined;
    if (!request) throw new Error("Solicitação de estorno não encontrada.");
    if (request.status === "completed") { db.exec("COMMIT"); return request; }
    if (request.status !== "processing") throw new Error("Esta solicitação não está em processamento.");
    const order = db.prepare("SELECT total_cents, refunded_cents FROM orders WHERE id = ?").get(request.order_id) as { total_cents: number; refunded_cents: number } | undefined;
    if (!order) throw new Error("Pedido não encontrado.");
    const refundedCents = Math.min(Number(order.total_cents), Number(order.refunded_cents || 0) + Number(request.requested_amount_cents));
    const full = refundedCents >= Number(order.total_cents);
    db.prepare("UPDATE refund_requests SET status = 'completed', provider_refund_id = ?, reviewed_by = ?, failure_message = NULL, updated_at = ? WHERE id = ?")
      .run(input.providerRefundId || null, input.actor, now, request.id);
    db.prepare("UPDATE orders SET refunded_cents = ?, payment_status = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(refundedCents, full ? "refunded" : "partially_refunded", full ? "cancelled" : "paid", now, request.order_id);
    db.prepare("UPDATE refund_requests SET status = 'completed', reviewed_by = ?, failure_message = NULL, updated_at = ? WHERE order_id = ? AND requested_by LIKE 'customer:%' AND status IN ('requested', 'processing')")
      .run(input.actor, now, request.order_id);
    db.exec("COMMIT");
    return getRefundRequest(request.id)!;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function failAdminRefund(input: { requestId: string; message: string; actor: string }) {
  const now = new Date().toISOString();
  getDatabase().prepare("UPDATE refund_requests SET status = 'failed', reviewed_by = ?, failure_message = ?, updated_at = ? WHERE id = ? AND status = 'processing'")
    .run(input.actor, input.message.slice(0, 500), now, input.requestId);
}

export function updateCustomerRefundRequest(input: { requestId?: string; orderId: string; status: "processing" | "completed" | "failed" | "rejected"; actor: string; message?: string }) {
  const now = new Date().toISOString();
  if (input.requestId) {
    getDatabase().prepare("UPDATE refund_requests SET status = ?, reviewed_by = ?, failure_message = ?, updated_at = ? WHERE id = ? AND order_id = ? AND status = 'requested'")
      .run(input.status, input.actor, input.message?.slice(0, 500) || null, now, input.requestId, input.orderId);
  }
}

export function completeProcessingRefundForOrder(orderId: string, actor = "webhook") {
  const request = getDatabase().prepare("SELECT id FROM refund_requests WHERE order_id = ? AND status = 'processing' ORDER BY created_at ASC LIMIT 1").get(orderId) as { id?: string } | undefined;
  if (request?.id) return completeAdminRefund({ requestId: request.id, actor });
  return null;
}

export function heartbeatVisitor(input: { visitorId: string; ipHash: string; path: string; device: string }) {
  const now = new Date().toISOString();
  const previous = getDatabase().prepare("SELECT path, last_seen_at FROM visitor_sessions WHERE visitor_id = ?").get(input.visitorId) as { path?: string; last_seen_at?: string } | undefined;
  getDatabase().prepare(`INSERT INTO visitor_sessions (visitor_id, ip_hash, path, device, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(visitor_id) DO UPDATE SET path=excluded.path, device=excluded.device, last_seen_at=excluded.last_seen_at`)
    .run(input.visitorId, input.ipHash, input.path, input.device, now, now);
  const sessionExpired = !previous?.last_seen_at || Date.now() - new Date(previous.last_seen_at).getTime() > 30 * 60_000;
  if (!previous || previous.path !== input.path || sessionExpired) recordAnalyticsEvent(input.visitorId, "page_view", input.path);
}

export function getLiveVisitors() {
  const since = new Date(Date.now() - 90_000).toISOString();
  return getDatabase().prepare("SELECT visitor_id, path, device, first_seen_at, last_seen_at FROM visitor_sessions WHERE last_seen_at >= ? ORDER BY last_seen_at DESC").all(since);
}

export function recordAnalyticsEvent(visitorId: string, event: string, pagePath: string, metadata?: unknown) {
  getDatabase().prepare("INSERT INTO analytics_events (id, visitor_id, event, path, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), visitorId, event, pagePath, metadata ? JSON.stringify(metadata) : null, new Date().toISOString());
}

type DatedValue = { created_at: string; total_cents?: number; visitor_id?: string; path?: string; event?: string };
const shortDay = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" });

function dayKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(date); }
function monthKey(date: Date) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date); }
function startOfRange(days: number) { return new Date(Date.now() - days * 86_400_000).toISOString(); }

export function getAdminAnalytics() {
  const db = getDatabase();
  const orders = db.prepare("SELECT total_cents, created_at FROM orders WHERE status = 'paid' AND created_at >= ? ORDER BY created_at").all(startOfRange(370)) as DatedValue[];
  const events = db.prepare("SELECT visitor_id, event, path, created_at FROM analytics_events WHERE created_at >= ? ORDER BY created_at").all(startOfRange(370)) as DatedValue[];
  const allTodayOrders = db.prepare("SELECT total_cents, status, created_at FROM orders WHERE created_at >= ?").all(startOfRange(2)) as Array<DatedValue & { status: string }>;
  const now = new Date();
  const todayKey = dayKey(now);
  const paidToday = allTodayOrders.filter((row) => row.status === "paid" && dayKey(new Date(row.created_at)) === todayKey);
  const ordersToday = allTodayOrders.filter((row) => dayKey(new Date(row.created_at)) === todayKey).length;
  const pageViewsToday = events.filter((event) => event.event === "page_view" && dayKey(new Date(event.created_at)) === todayKey);
  const visitorsToday = new Set(pageViewsToday.map((event) => event.visitor_id)).size;
  const revenueTodayCents = paidToday.reduce((sum, row) => sum + Number(row.total_cents || 0), 0);
  const conversion = visitorsToday ? ordersToday / visitorsToday * 100 : 0;
  const ticketAverageCents = paidToday.length ? Math.round(revenueTodayCents / paidToday.length) : 0;

  const makeDaily = (days: number) => Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * 86_400_000);
    const key = dayKey(date);
    return { label: days <= 7 ? shortDay.format(date).replace(".", "") : shortDate.format(date), value: orders.filter((row) => dayKey(new Date(row.created_at)) === key).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) };
  });
  const today = Array.from({ length: 8 }, (_, index) => {
    const hour = index * 3;
    return { label: `${String(hour).padStart(2, "0")}h`, value: orders.filter((row) => { const date = new Date(row.created_at); return dayKey(date) === todayKey && Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(date)) >= hour && Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(date)) < hour + 3; }).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) };
  });
  const year = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 15));
    const key = monthKey(date);
    return { label: monthName.format(date).replace(".", ""), value: orders.filter((row) => monthKey(new Date(row.created_at)) === key).reduce((sum, row) => sum + Number(row.total_cents || 0), 0) };
  });

  const accessData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000);
    const key = dayKey(date);
    const views = events.filter((event) => event.event === "page_view" && dayKey(new Date(event.created_at)) === key);
    return { label: shortDay.format(date).replace(".", ""), sessions: views.length, visitors: new Set(views.map((event) => event.visitor_id)).size };
  });
  const sevenDays = events.filter((event) => new Date(event.created_at).getTime() >= Date.now() - 7 * 86_400_000);
  const pageViews = sevenDays.filter((event) => event.event === "page_view");
  const pageCounts = new Map<string, number>();
  for (const event of pageViews) pageCounts.set(String(event.path), (pageCounts.get(String(event.path)) || 0) + 1);
  const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, views]) => ({ path, views }));
  const visitorRows = db.prepare("SELECT first_seen_at, last_seen_at FROM visitor_sessions WHERE last_seen_at >= ?").all(startOfRange(7)) as Array<{ first_seen_at: string; last_seen_at: string }>;
  const averageSeconds = visitorRows.length ? Math.round(visitorRows.reduce((sum, row) => sum + Math.max(0, (new Date(row.last_seen_at).getTime() - new Date(row.first_seen_at).getTime()) / 1000), 0) / visitorRows.length) : 0;
  return {
    dashboard: { revenueTodayCents, ordersToday, visitorsToday, conversion, ticketAverageCents },
    sales: { today, week: makeDaily(7), month: makeDaily(30), year },
    accessData,
    overview: {
      accesses: pageViews.length,
      visitors: new Set(pageViews.map((event) => event.visitor_id)).size,
      addedToCart: sevenDays.filter((event) => event.event === "add_to_cart").length,
      checkoutStarted: sevenDays.filter((event) => event.event === "begin_checkout").length,
      purchases: sevenDays.filter((event) => event.event === "purchase").length,
      averageSeconds,
    },
    topPages,
  };
}

export function startWebhook(provider: string, eventId: string) {
  const result = getDatabase().prepare("INSERT OR IGNORE INTO webhook_events (provider, provider_event_id, status, received_at) VALUES (?, ?, 'received', ?)").run(provider, eventId, new Date().toISOString());
  return Number(result.changes) === 1;
}

export function finishWebhook(provider: string, eventId: string, status: string) {
  getDatabase().prepare("UPDATE webhook_events SET status = ?, processed_at = ? WHERE provider = ? AND provider_event_id = ?").run(status, new Date().toISOString(), provider, eventId);
}

export function audit(actor: string, action: string, target?: string, metadata?: unknown) {
  getDatabase().prepare("INSERT INTO audit_logs (id, actor, action, target, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), actor, action, target || null, metadata ? JSON.stringify(metadata) : null, new Date().toISOString());
}

export function saveProductConfig(productId: string, config: unknown, actor: string) {
  getDatabase().prepare(`INSERT INTO product_configs (product_id, config_json, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET config_json=excluded.config_json, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .run(productId, JSON.stringify(config), actor, new Date().toISOString());
  audit(actor, "product.config_saved", productId);
}

export function listProductConfigs() {
  const rows = getDatabase().prepare("SELECT product_id, config_json FROM product_configs ORDER BY product_id").all() as Array<{ product_id: string; config_json: string }>;
  return rows.flatMap((row) => {
    try { return [{ productId: row.product_id, config: JSON.parse(row.config_json) as Record<string, unknown> }]; }
    catch { return []; }
  });
}

export function getStoredStoreSettings() {
  const row = getDatabase().prepare("SELECT config_json FROM store_settings WHERE id = 'store'").get() as { config_json?: string } | undefined;
  if (!row?.config_json) return null;
  try { return JSON.parse(row.config_json) as Record<string, unknown>; }
  catch { return null; }
}

export function saveStoreSettings(config: unknown, actor: string) {
  const now = new Date().toISOString();
  getDatabase().prepare(`INSERT INTO store_settings (id, config_json, updated_by, updated_at) VALUES ('store', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .run(JSON.stringify(config), actor, now);
  audit(actor, "store.settings_saved", "store");
}

export type Coupon = {
  code: string;
  kind: "percentage" | "fixed";
  value: number;
  minimumCents: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type CouponRow = {
  code: string;
  kind: "percentage" | "fixed";
  value: number;
  minimum_cents: number;
  expires_at: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

function mapCoupon(row: CouponRow): Coupon {
  return {
    code: row.code,
    kind: row.kind,
    value: Number(row.value),
    minimumCents: Number(row.minimum_cents),
    expiresAt: row.expires_at,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCoupons(): Coupon[] {
  const rows = getDatabase().prepare("SELECT * FROM coupons ORDER BY active DESC, created_at DESC").all() as CouponRow[];
  return rows.map(mapCoupon);
}

export function saveCoupon(input: { code: string; kind: "percentage" | "fixed"; value: number; minimumCents: number; expiresAt: string | null; active: boolean }, actor: string) {
  const code = input.code.trim().toUpperCase();
  const now = new Date().toISOString();
  getDatabase().prepare(`INSERT INTO coupons (code, kind, value, minimum_cents, expires_at, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value, minimum_cents=excluded.minimum_cents,
    expires_at=excluded.expires_at, active=excluded.active, updated_at=excluded.updated_at`)
    .run(code, input.kind, input.value, input.minimumCents, input.expiresAt, input.active ? 1 : 0, now, now);
  audit(actor, "coupon.saved", code, { kind: input.kind, value: input.value, active: input.active });
  return getCoupon(code)!;
}

export function getCoupon(code: string): Coupon | null {
  const row = getDatabase().prepare("SELECT * FROM coupons WHERE code = ?").get(code.trim().toUpperCase()) as CouponRow | undefined;
  return row ? mapCoupon(row) : null;
}

export function deleteCoupon(code: string, actor: string) {
  getDatabase().prepare("DELETE FROM coupons WHERE code = ?").run(code.trim().toUpperCase());
  audit(actor, "coupon.deleted", code.trim().toUpperCase());
}

export function validateCoupon(code: string, subtotalCents: number) {
  const coupon = getCoupon(code);
  if (!coupon || !coupon.active) return { valid: false as const, message: "Cupom inválido ou desativado." };
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return { valid: false as const, message: "Este cupom expirou." };
  if (subtotalCents < coupon.minimumCents) return { valid: false as const, message: `Este cupom exige uma compra mínima de R$ ${(coupon.minimumCents / 100).toFixed(2).replace(".", ",")}.` };
  const discountCents = coupon.kind === "percentage"
    ? Math.round(subtotalCents * Math.min(coupon.value, 100) / 100)
    : Math.min(coupon.value, subtotalCents);
  return { valid: true as const, coupon, discountCents, message: "Cupom aplicado." };
}

export type FiscalDocument = {
  id: string;
  order_id: string;
  provider: string;
  provider_reference: string;
  status: "queued" | "processing" | "authorized" | "error" | "cancelled";
  access_key: string | null;
  number: string | null;
  series: string | null;
  danfe_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getFiscalDocumentForOrder(orderId: string): FiscalDocument | null {
  return (getDatabase().prepare("SELECT * FROM fiscal_documents WHERE order_id = ?").get(orderId) as FiscalDocument | undefined) || null;
}

export function getFiscalDocumentByReference(reference: string): FiscalDocument | null {
  return (getDatabase().prepare("SELECT * FROM fiscal_documents WHERE provider_reference = ?").get(reference) as FiscalDocument | undefined) || null;
}

export function beginFiscalDocument(orderId: string, reference: string) {
  const db = getDatabase();
  const existing = getFiscalDocumentForOrder(orderId);
  if (existing && ["queued", "processing", "authorized", "cancelled"].includes(existing.status)) return { document: existing, started: false };
  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE fiscal_documents SET status = 'queued', error_message = NULL, updated_at = ? WHERE id = ?").run(now, existing.id);
  } else {
    db.prepare("INSERT INTO fiscal_documents (id, order_id, provider, provider_reference, status, created_at, updated_at) VALUES (?, ?, 'focus_nfe', ?, 'queued', ?, ?)")
      .run(randomUUID(), orderId, reference, now, now);
  }
  return { document: getFiscalDocumentForOrder(orderId)!, started: true };
}

export function updateFiscalDocument(reference: string, input: {
  status: FiscalDocument["status"];
  accessKey?: string | null;
  number?: string | null;
  series?: string | null;
  danfeUrl?: string | null;
  xmlUrl?: string | null;
  errorMessage?: string | null;
}) {
  const now = new Date().toISOString();
  getDatabase().prepare(`UPDATE fiscal_documents SET status = ?, access_key = COALESCE(?, access_key), number = COALESCE(?, number),
    series = COALESCE(?, series), danfe_url = COALESCE(?, danfe_url), xml_url = COALESCE(?, xml_url), error_message = ?,
    issued_at = CASE WHEN ? = 'authorized' THEN COALESCE(issued_at, ?) ELSE issued_at END, updated_at = ? WHERE provider_reference = ?`)
    .run(input.status, input.accessKey ?? null, input.number ?? null, input.series ?? null, input.danfeUrl ?? null, input.xmlUrl ?? null,
      input.errorMessage ?? null, input.status, now, now, reference);
}

export const integrationProviders = ["mercado_pago", "appmax", "melhor_envio", "google_merchant", "carrier_direct", "mercado_livre", "shopee", "meta_conversions", "google_ads", "focus_nfe", "supabase"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

export type IntegrationConfig = {
  provider: IntegrationProvider;
  enabled: boolean;
  environment: "sandbox" | "production";
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
  secretKeys: string[];
  lastTestStatus: "success" | "failed" | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
  updatedAt: string | null;
};

type IntegrationRow = {
  provider: IntegrationProvider;
  enabled: number;
  environment: "sandbox" | "production";
  public_config_json: string;
  secret_config_encrypted: string | null;
  last_test_status: "success" | "failed" | null;
  last_test_message: string | null;
  last_tested_at: string | null;
  updated_at: string;
};

function parseJsonRecord(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

function mapIntegrationRow(row: IntegrationRow): IntegrationConfig {
  const secrets = row.secret_config_encrypted ? decryptPrivateJson<Record<string, string>>(row.secret_config_encrypted) : {};
  return {
    provider: row.provider,
    enabled: Boolean(row.enabled),
    environment: row.environment,
    publicConfig: parseJsonRecord(row.public_config_json),
    secrets,
    secretKeys: Object.keys(secrets).filter((key) => Boolean(secrets[key])),
    lastTestStatus: row.last_test_status,
    lastTestMessage: row.last_test_message,
    lastTestedAt: row.last_tested_at,
    updatedAt: row.updated_at,
  };
}

export function getIntegrationConfig(provider: IntegrationProvider): IntegrationConfig | null {
  const row = getDatabase().prepare("SELECT * FROM integration_configs WHERE provider = ?").get(provider) as IntegrationRow | undefined;
  return row ? mapIntegrationRow(row) : null;
}

export function listIntegrationConfigs() {
  const rows = getDatabase().prepare("SELECT * FROM integration_configs ORDER BY provider").all() as IntegrationRow[];
  const byProvider = new Map(rows.map((row) => [row.provider, mapIntegrationRow(row)]));
  return integrationProviders.map((provider): IntegrationConfig => byProvider.get(provider) || {
    provider,
    enabled: false,
    environment: "sandbox",
    publicConfig: {},
    secrets: {},
    secretKeys: [],
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestedAt: null,
    updatedAt: null,
  });
}

export function saveIntegrationConfig(input: {
  provider: IntegrationProvider;
  enabled: boolean;
  environment: "sandbox" | "production";
  publicConfig: Record<string, string>;
  secrets: Record<string, string>;
}, actor: string) {
  const db = getDatabase();
  const existing = getIntegrationConfig(input.provider);
  const suppliedSecrets = Object.fromEntries(Object.entries(input.secrets).filter(([, value]) => value.trim().length > 0));
  const mergedSecrets = { ...(existing?.secrets || {}), ...suppliedSecrets };
  const credentialsChanged = !existing
    || existing.environment !== input.environment
    || JSON.stringify(existing.publicConfig) !== JSON.stringify(input.publicConfig)
    || Object.keys(suppliedSecrets).length > 0;
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (input.enabled && (input.provider === "mercado_pago" || input.provider === "appmax")) {
      db.prepare("UPDATE integration_configs SET enabled = 0, updated_at = ? WHERE provider IN ('mercado_pago', 'appmax') AND provider <> ?").run(now, input.provider);
    }
    db.prepare(`INSERT INTO integration_configs (provider, enabled, environment, public_config_json, secret_config_encrypted, last_test_status, last_test_message, last_tested_at, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET enabled=excluded.enabled, environment=excluded.environment,
      public_config_json=excluded.public_config_json, secret_config_encrypted=excluded.secret_config_encrypted,
      last_test_status=excluded.last_test_status, last_test_message=excluded.last_test_message, last_tested_at=excluded.last_tested_at,
      updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
      .run(
        input.provider,
        input.enabled ? 1 : 0,
        input.environment,
        JSON.stringify(input.publicConfig),
        Object.keys(mergedSecrets).length ? encryptPrivateJson(mergedSecrets) : null,
        credentialsChanged ? null : existing?.lastTestStatus || null,
        credentialsChanged ? null : existing?.lastTestMessage || null,
        credentialsChanged ? null : existing?.lastTestedAt || null,
        actor,
        now,
      );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  audit(actor, "integration.config_saved", input.provider, { enabled: input.enabled, environment: input.environment, publicFields: Object.keys(input.publicConfig), secretFieldsUpdated: Object.keys(suppliedSecrets) });
}

export function saveIntegrationTest(provider: IntegrationProvider, status: "success" | "failed", message: string, actor: string) {
  const now = new Date().toISOString();
  getDatabase().prepare("UPDATE integration_configs SET last_test_status = ?, last_test_message = ?, last_tested_at = ?, updated_by = ?, updated_at = ? WHERE provider = ?")
    .run(status, message.slice(0, 300), now, actor, now, provider);
  audit(actor, `integration.test_${status}`, provider);
}

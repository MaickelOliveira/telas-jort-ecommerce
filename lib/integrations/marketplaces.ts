import "server-only";

import { createHmac } from "node:crypto";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

export type MarketplaceChannel = "mercado_livre" | "shopee";

export type MarketplaceOrder = {
  channel: MarketplaceChannel;
  externalId: string;
  createdAt: string;
  customer: string;
  status: string;
  totalCents: number;
  itemCount: number;
  currency: string;
};

export type MarketplaceProduct = {
  channel: MarketplaceChannel;
  externalId: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  sold: number;
  status: string;
  url: string | null;
};

export type MarketplaceChannelSnapshot = {
  channel: MarketplaceChannel;
  connected: boolean;
  accountName: string;
  orders: MarketplaceOrder[];
  products: MarketplaceProduct[];
  error: string | null;
  updatedAt: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cents(value: unknown) {
  return Math.round(number(value) * 100);
}

function errorMessage(payload: unknown, fallback: string) {
  const body = record(payload);
  const nestedError = record(body.error);
  return text(body.message) || text(body.error) || text(nestedError.message) || fallback;
}

async function jsonRequest(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({})) as unknown;
  if (!response.ok) throw new Error(errorMessage(payload, `HTTP ${response.status}`));
  return payload;
}

function disconnected(channel: MarketplaceChannel, accountName: string): MarketplaceChannelSnapshot {
  return { channel, connected: false, accountName, orders: [], products: [], error: null, updatedAt: new Date().toISOString() };
}

async function mercadoLivreSnapshot(): Promise<MarketplaceChannelSnapshot> {
  const config = getRuntimeIntegrationConfig("mercado_livre");
  if (!config.enabled || !config.secrets.accessToken) return disconnected("mercado_livre", config.publicConfig.nickname || "Mercado Livre");

  const headers = { authorization: `Bearer ${config.secrets.accessToken}`, accept: "application/json" };
  try {
    let sellerId = config.publicConfig.userId;
    let accountName = config.publicConfig.nickname || "Mercado Livre";
    if (!sellerId) {
      const me = record(await jsonRequest("https://api.mercadolibre.com/users/me", { headers }));
      sellerId = text(me.id);
      accountName = text(me.nickname, accountName);
    }
    if (!sellerId) throw new Error("A conta não informou o ID do vendedor.");

    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    const orderUrl = new URL("https://api.mercadolibre.com/orders/search");
    orderUrl.searchParams.set("seller", sellerId);
    orderUrl.searchParams.set("order.date_created.from", from);
    orderUrl.searchParams.set("order.date_created.to", to);
    orderUrl.searchParams.set("sort", "date_desc");
    orderUrl.searchParams.set("limit", "50");

    const itemSearchUrl = new URL(`https://api.mercadolibre.com/users/${encodeURIComponent(sellerId)}/items/search`);
    itemSearchUrl.searchParams.set("limit", "100");
    itemSearchUrl.searchParams.set("offset", "0");

    const [orderPayload, itemSearchPayload] = await Promise.all([
      jsonRequest(orderUrl, { headers }),
      jsonRequest(itemSearchUrl, { headers }),
    ]);

    const orders = list(record(orderPayload).results).map((raw): MarketplaceOrder => {
      const order = record(raw);
      const buyer = record(order.buyer);
      const items = list(order.order_items);
      return {
        channel: "mercado_livre",
        externalId: text(order.id),
        createdAt: text(order.date_created, new Date().toISOString()),
        customer: text(buyer.nickname, "Cliente Mercado Livre"),
        status: text(order.status, "desconhecido"),
        totalCents: cents(order.paid_amount ?? order.total_amount),
        itemCount: items.reduce<number>((sum, rawItem) => sum + Math.max(1, number(record(rawItem).quantity)), 0),
        currency: text(order.currency_id, "BRL"),
      };
    });

    const ids = list(record(itemSearchPayload).results).map((id) => text(id)).filter(Boolean).slice(0, 100);
    const products: MarketplaceProduct[] = [];
    for (let offset = 0; offset < ids.length; offset += 20) {
      const batch = ids.slice(offset, offset + 20);
      const itemUrl = new URL("https://api.mercadolibre.com/items");
      itemUrl.searchParams.set("ids", batch.join(","));
      itemUrl.searchParams.set("attributes", "id,title,price,available_quantity,sold_quantity,status,permalink,seller_custom_field");
      const itemPayload = await jsonRequest(itemUrl, { headers });
      for (const raw of list(itemPayload)) {
        const wrapper = record(raw);
        const item = record(wrapper.body);
        if (!text(item.id)) continue;
        products.push({
          channel: "mercado_livre",
          externalId: text(item.id),
          sku: text(item.seller_custom_field, "Sem SKU"),
          name: text(item.title, "Produto sem nome"),
          priceCents: cents(item.price),
          stock: number(item.available_quantity),
          sold: number(item.sold_quantity),
          status: text(item.status, "desconhecido"),
          url: text(item.permalink) || null,
        });
      }
    }

    return { channel: "mercado_livre", connected: true, accountName, orders, products, error: null, updatedAt: new Date().toISOString() };
  } catch (error) {
    return {
      channel: "mercado_livre",
      connected: true,
      accountName: config.publicConfig.nickname || "Mercado Livre",
      orders: [],
      products: [],
      error: error instanceof Error ? error.message : "Não foi possível atualizar o Mercado Livre.",
      updatedAt: new Date().toISOString(),
    };
  }
}

function shopeeUrl(path: string, query: Record<string, string>) {
  const config = getRuntimeIntegrationConfig("shopee");
  const partnerId = number(config.publicConfig.partnerId);
  const shopId = number(config.publicConfig.shopId);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `${partnerId}${path}${timestamp}${config.secrets.accessToken}${shopId}`;
  const sign = createHmac("sha256", config.secrets.partnerKey).update(signatureBase).digest("hex");
  const host = config.environment === "sandbox" ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com";
  const url = new URL(path, host);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", config.secrets.accessToken);
  url.searchParams.set("shop_id", String(shopId));
  url.searchParams.set("sign", sign);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}

async function shopeeRequest(path: string, query: Record<string, string>, init?: { method?: "GET" | "POST"; body?: unknown }) {
  const payload = await jsonRequest(shopeeUrl(path, query), {
    method: init?.method || "GET",
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = record(payload);
  if (text(body.error)) throw new Error(text(body.message) || text(body.error));
  return record(body.response);
}

async function shopeeSnapshot(): Promise<MarketplaceChannelSnapshot> {
  const config = getRuntimeIntegrationConfig("shopee");
  const configured = config.enabled && config.secrets.accessToken && config.secrets.partnerKey && config.publicConfig.partnerId && config.publicConfig.shopId;
  if (!configured) return disconnected("shopee", config.publicConfig.shopName || "Shopee");

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const fromSeconds = nowSeconds - 30 * 86_400;
    const [orderList, ...productLists] = await Promise.all([
      shopeeRequest("/api/v2/order/get_order_list", {
        time_range_field: "create_time",
        time_from: String(fromSeconds),
        time_to: String(nowSeconds),
        page_size: "100",
      }),
      ...["NORMAL", "UNLIST", "BANNED"].map((itemStatus) => shopeeRequest("/api/v2/product/get_item_list", {
        offset_page_no: "0",
        page_size: "100",
        item_status: itemStatus,
      }).catch(() => ({}))),
    ]);

    const orderSns = list(orderList.order_list).map((raw) => text(record(raw).order_sn)).filter(Boolean).slice(0, 50);
    const orderDetails: unknown[] = [];
    for (let offset = 0; offset < orderSns.length; offset += 50) {
      const detail = await shopeeRequest("/api/v2/order/get_order_detail", {
        order_sn_list: orderSns.slice(offset, offset + 50).join(","),
        response_optional_fields: "buyer_username,item_list,total_amount,currency,create_time,order_status",
      });
      orderDetails.push(...list(detail.order_list));
    }
    const orders = orderDetails.map((raw): MarketplaceOrder => {
      const order = record(raw);
      const items = list(order.item_list);
      return {
        channel: "shopee",
        externalId: text(order.order_sn),
        createdAt: new Date(number(order.create_time) * 1000).toISOString(),
        customer: text(order.buyer_username, "Cliente Shopee"),
        status: text(order.order_status, "desconhecido"),
        totalCents: cents(order.total_amount),
        itemCount: items.reduce<number>((sum, rawItem) => sum + Math.max(1, number(record(rawItem).model_quantity_purchased)), 0),
        currency: text(order.currency, "BRL"),
      };
    });

    const itemIds = [...new Set(productLists.flatMap((payload) => list(record(payload).item).map((raw) => text(record(raw).item_id))).filter(Boolean))].slice(0, 100);
    const itemDetails: unknown[] = [];
    for (let offset = 0; offset < itemIds.length; offset += 50) {
      const detail = await shopeeRequest("/api/v2/product/get_item_base_info", {
        item_id_list: itemIds.slice(offset, offset + 50).join(","),
        need_tax_info: "false",
      });
      itemDetails.push(...list(detail.item_list));
    }
    const products = itemDetails.map((raw): MarketplaceProduct => {
      const item = record(raw);
      const priceInfo = record(list(item.price_info)[0]);
      const stockInfo = record(item.stock_info_v2);
      const summaryInfo = record(stockInfo.summary_info);
      return {
        channel: "shopee",
        externalId: text(item.item_id),
        sku: text(item.item_sku, "Sem SKU"),
        name: text(item.item_name, "Produto sem nome"),
        priceCents: cents(priceInfo.current_price ?? priceInfo.original_price),
        stock: number(summaryInfo.total_available_stock),
        sold: number(item.sold),
        status: text(item.item_status, "desconhecido"),
        url: null,
      };
    });

    return {
      channel: "shopee",
      connected: true,
      accountName: config.publicConfig.shopName || `Loja ${config.publicConfig.shopId}`,
      orders,
      products,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      channel: "shopee",
      connected: true,
      accountName: config.publicConfig.shopName || "Shopee",
      orders: [],
      products: [],
      error: error instanceof Error ? error.message : "Não foi possível atualizar a Shopee.",
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function getMarketplaceDashboard() {
  const channels = await Promise.all([mercadoLivreSnapshot(), shopeeSnapshot()]);
  const orders = channels.flatMap((channel) => channel.orders).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const products = channels.flatMap((channel) => channel.products).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { channels, orders, products };
}

export function isMarketplaceProductActive(product: Pick<MarketplaceProduct, "channel" | "status">) {
  const status = product.status.toLowerCase();
  return product.channel === "mercado_livre" ? status === "active" : status === "normal";
}

export async function setMarketplaceProductActive(channel: MarketplaceChannel, externalId: string, active: boolean) {
  if (channel === "mercado_livre") {
    const config = getRuntimeIntegrationConfig("mercado_livre");
    if (!config.enabled || !config.secrets.accessToken) throw new Error("Conecte e habilite o Mercado Livre antes de alterar anúncios.");
    const payload = await jsonRequest(`https://api.mercadolibre.com/items/${encodeURIComponent(externalId)}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${config.secrets.accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: active ? "active" : "paused" }),
    });
    const item = record(payload);
    return { active: text(item.status).toLowerCase() === "active", status: text(item.status, active ? "active" : "paused") };
  }

  const config = getRuntimeIntegrationConfig("shopee");
  if (!config.enabled || !config.secrets.accessToken || !config.secrets.partnerKey) throw new Error("Conecte e habilite a Shopee antes de alterar anúncios.");
  await shopeeRequest("/api/v2/product/unlist_item", {}, {
    method: "POST",
    body: { item_list: [{ item_id: number(externalId), unlist: !active }] },
  });
  return { active, status: active ? "NORMAL" : "UNLIST" };
}

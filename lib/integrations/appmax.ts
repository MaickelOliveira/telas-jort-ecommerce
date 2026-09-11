import "server-only";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

type TokenCache = { token: string; expiresAt: number };
type AppmaxGlobal = typeof globalThis & { __appmaxToken?: TokenCache };

async function appmaxBases() {
  const config = await getRuntimeIntegrationConfig("appmax");
  return {
    config,
    authBase: config.environment === "production" ? "https://auth.appmax.com.br" : "https://auth.sandboxappmax.com.br",
    apiBase: config.environment === "production" ? "https://api.appmax.com.br" : "https://api.sandboxappmax.com.br",
  };
}

export async function getAppmaxAccessToken() {
  const globals = globalThis as AppmaxGlobal;
  if (globals.__appmaxToken && globals.__appmaxToken.expiresAt > Date.now() + 30_000) return globals.__appmaxToken.token;
  const { config, authBase } = await appmaxBases();
  if (!config.secrets.clientId || !config.secrets.clientSecret) throw new Error("Appmax não configurada.");
  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.secrets.clientId, client_secret: config.secrets.clientSecret }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; message?: string };
  if (!response.ok || !result.access_token) throw new Error(result.message || "A Appmax recusou as credenciais.");
  globals.__appmaxToken = { token: result.access_token, expiresAt: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000 };
  return result.access_token;
}

export async function fetchAppmaxOrder(orderId: string) {
  if (!/^\d+$/.test(orderId)) throw new Error("Identificador Appmax inválido.");
  const { apiBase } = await appmaxBases();
  const token = await getAppmaxAccessToken();
  const response = await fetch(`${apiBase}/v1/orders/${orderId}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({})) as { data?: { order?: { id?: number; status?: string } }; message?: string };
  if (!response.ok || !result.data?.order) throw new Error(result.message || "Não foi possível confirmar o pedido na Appmax.");
  return result.data.order;
}

export async function requestAppmaxRefund(input: { orderId: string; amountCents: number; full: boolean }) {
  if (!/^\d+$/.test(input.orderId)) throw new Error("Identificador Appmax inválido.");
  const { config, apiBase } = await appmaxBases();
  if (!config.enabled) throw new Error("Configure e habilite a Appmax antes de realizar o estorno.");
  const token = await getAppmaxAccessToken();
  const response = await fetch(`${apiBase}/v1/orders/refund-request`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ order_id: Number(input.orderId), type: input.full ? "total" : "partial", value: input.amountCents }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({})) as { data?: { refund?: { id?: number | string; status?: string }; order?: { id?: number | string; status?: string } }; message?: string; error?: string };
  if (!response.ok) throw new Error(result.message || result.error || "A Appmax recusou a solicitação de estorno.");
  return {
    id: result.data?.refund?.id ? String(result.data.refund.id) : result.data?.order?.id ? String(result.data.order.id) : undefined,
    status: String(result.data?.refund?.status || result.data?.order?.status || "requested"),
  };
}

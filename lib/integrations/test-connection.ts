import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import type { IntegrationProvider } from "@/lib/database";

type TestResult = { ok: boolean; message: string };

async function readError(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string; error?: string | { message?: string } };
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object" && body.error.message) return body.error.message;
  return body.message || `HTTP ${response.status}`;
}

async function testMercadoPago(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("mercado_pago");
  if (!config.secrets.accessToken || !config.publicConfig.publicKey) return { ok: false, message: "Informe a Public Key e o Access Token." };
  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: { authorization: `Bearer ${config.secrets.accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { ok: false, message: `Mercado Pago recusou as credenciais: ${await readError(response)}` };
  return { ok: true, message: "Conta autenticada pelo Mercado Pago." };
}

async function testAppmax(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("appmax");
  if (!config.secrets.clientId || !config.secrets.clientSecret) return { ok: false, message: "Informe o Client ID e o Client Secret do merchant." };
  const authBase = config.environment === "production" ? "https://auth.appmax.com.br" : "https://auth.sandboxappmax.com.br";
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: config.secrets.clientId, client_secret: config.secrets.clientSecret });
  const response = await fetch(`${authBase}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { ok: false, message: `Appmax recusou as credenciais: ${await readError(response)}` };
  const result = await response.json().catch(() => ({})) as { access_token?: string };
  return result.access_token ? { ok: true, message: "Merchant autenticado pela Appmax." } : { ok: false, message: "A Appmax respondeu sem gerar o token de acesso." };
}

async function testMelhorEnvio(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("melhor_envio");
  if (!config.secrets.token) return { ok: false, message: "Informe o token do Melhor Envio." };
  if (!/^\d{8}$/.test((config.publicConfig.originPostalCode || "").replace(/\D/g, ""))) return { ok: false, message: "Informe o CEP de origem com 8 números." };
  const base = config.environment === "production" ? "https://melhorenvio.com.br/api/v2" : "https://sandbox.melhorenvio.com.br/api/v2";
  const response = await fetch(`${base}/me/shipment/calculate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secrets.token}`,
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": config.publicConfig.userAgentEmail || "Telas Jort (tecnologia@telasjort.com.br)",
    },
    body: JSON.stringify({
      from: { postal_code: config.publicConfig.originPostalCode.replace(/\D/g, "") },
      to: { postal_code: "01001000" },
      products: [{ id: "connection-test", width: 11, height: 2, length: 16, weight: 0.3, insurance_value: 10, quantity: 1 }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401 || response.status === 403) return { ok: false, message: `Melhor Envio recusou o token: ${await readError(response)}` };
  if (!response.ok) return { ok: false, message: `Não foi possível validar: ${await readError(response)}` };
  return { ok: true, message: "Token aceito e cálculo de teste concluído pelo Melhor Envio." };
}

async function testMercadoLivre(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("mercado_livre");
  if (!config.publicConfig.appId || !config.secrets.clientSecret || !config.secrets.accessToken) {
    return { ok: false, message: "Informe App ID, Client Secret e Access Token do Mercado Livre." };
  }
  const response = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { authorization: `Bearer ${config.secrets.accessToken}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { ok: false, message: `Mercado Livre recusou as credenciais: ${await readError(response)}` };
  const result = await response.json().catch(() => ({})) as { id?: number | string; nickname?: string; site_id?: string };
  return { ok: true, message: `Conta Mercado Livre conectada${result.nickname ? `: ${result.nickname}` : result.id ? ` (vendedor ${result.id})` : ""}.` };
}

async function testShopee(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("shopee");
  const partnerId = Number(config.publicConfig.partnerId);
  const shopId = Number(config.publicConfig.shopId);
  const partnerKey = config.secrets.partnerKey;
  const accessToken = config.secrets.accessToken;
  if (!Number.isSafeInteger(partnerId) || !Number.isSafeInteger(shopId) || !partnerKey || !accessToken) {
    return { ok: false, message: "Informe Partner ID, Shop ID, Partner Key e Access Token da Shopee." };
  }
  const path = "/api/v2/shop/get_shop_info";
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const sign = createHmac("sha256", partnerKey).update(signatureBase).digest("hex");
  const host = config.environment === "sandbox" ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com";
  const url = new URL(path, host);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", String(shopId));
  url.searchParams.set("sign", sign);
  const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const result = await response.json().catch(() => ({})) as { error?: string; message?: string; shop_name?: string };
  if (!response.ok || result.error) return { ok: false, message: `Shopee recusou as credenciais: ${result.message || result.error || `HTTP ${response.status}`}` };
  return { ok: true, message: `Loja Shopee conectada${result.shop_name ? `: ${result.shop_name}` : ""}.` };
}

async function testMetaConversions(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("meta_conversions");
  const pixelId = config.publicConfig.pixelId;
  const token = config.secrets.accessToken;
  const testEventCode = config.publicConfig.testEventCode;
  const version = /^v\d+\.\d+$/.test(config.publicConfig.graphApiVersion || "") ? config.publicConfig.graphApiVersion : "v25.0";
  if (!pixelId || !token) return { ok: false, message: "Informe o ID do Pixel e o token da API de Conversões." };
  if (!testEventCode) return { ok: false, message: "Informe o código exibido em Gerenciador de Eventos → Testar eventos para validar sem contaminar os relatórios reais." };
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `integration-test-${randomUUID()}`,
        action_source: "website",
        event_source_url: process.env.APP_URL || "https://telasjort.com.br/",
        user_data: { external_id: [createHash("sha256").update("telas-jort-integration-test").digest("hex")], client_user_agent: "Telas Jort CAPI connection test" },
      }],
      test_event_code: testEventCode,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({})) as { events_received?: number; error?: { message?: string } };
  if (!response.ok || !result.events_received) return { ok: false, message: `Meta recusou o evento de teste: ${result.error?.message || `HTTP ${response.status}`}` };
  return { ok: true, message: "Pixel e API de Conversões validados. O evento apareceu no modo de teste da Meta." };
}

async function testFocusNfe(): Promise<TestResult> {
  const config = await getRuntimeIntegrationConfig("focus_nfe");
  const token = config.secrets.token;
  const cnpj = (config.publicConfig.issuerCnpj || "").replace(/\D/g, "");
  if (!token || !/^\d{14}$/.test(cnpj)) return { ok: false, message: "Informe o token da Focus NFe e o CNPJ do emitente com 14 números." };
  const base = config.environment === "production" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
  const response = await fetch(`${base}/v2/nfe/telas-jort-teste-conexao`, {
    headers: { authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401 || response.status === 403) return { ok: false, message: `Focus NFe recusou o token: ${await readError(response)}` };
  if (response.status !== 200 && response.status !== 404) return { ok: false, message: `Não foi possível validar a Focus NFe: ${await readError(response)}` };
  return { ok: true, message: `Token aceito no ambiente de ${config.environment === "production" ? "produção" : "homologação"}. A emissão automática só ocorrerá quando a integração for habilitada.` };
}

export async function testIntegrationConnection(provider: IntegrationProvider): Promise<TestResult> {
  if (provider === "mercado_pago") return testMercadoPago();
  if (provider === "appmax") return testAppmax();
  if (provider === "melhor_envio") return testMelhorEnvio();
  if (provider === "mercado_livre") return testMercadoLivre();
  if (provider === "shopee") return testShopee();
  if (provider === "meta_conversions") return testMetaConversions();
  if (provider === "focus_nfe") return testFocusNfe();
  if (provider === "google_ads") {
    const config = await getRuntimeIntegrationConfig(provider);
    return /^AW-\d{5,30}$/.test(config.publicConfig.conversionId || "") && /^[A-Za-z0-9_-]{5,100}$/.test(config.publicConfig.purchaseLabel || "")
      ? { ok: true, message: "Formato da Google tag e do rótulo de compra validados. Confirme o recebimento final em Diagnóstico da ação de conversão." }
      : { ok: false, message: "Informe o ID no formato AW-123456789 e o rótulo da conversão de compra." };
  }
  if (provider === "google_merchant") {
    const config = await getRuntimeIntegrationConfig(provider);
    return config.publicConfig.merchantId
      ? { ok: true, message: "ID salvo. A validação final do domínio é feita no Merchant Center." }
      : { ok: false, message: "Informe o ID do Merchant Center." };
  }
  return { ok: false, message: "Contratos diretos precisam de um adaptador homologado para cada transportadora; a plataforma não acessa URLs arbitrárias por segurança." };
}

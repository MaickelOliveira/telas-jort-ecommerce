import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { getRuntimeIntegrationConfig, listSafeRuntimeIntegrationConfigs } from "@/lib/integration-config";
import { integrationProviders, saveIntegrationConfig, saveIntegrationTest, type IntegrationProvider } from "@/lib/database";
import { testIntegrationConnection } from "@/lib/integrations/test-connection";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const providerSchema = z.enum(integrationProviders);
const textRecord = z.record(z.string().max(60), z.string().trim().max(2_000));
const saveSchema = z.object({
  action: z.literal("save"),
  provider: providerSchema,
  enabled: z.boolean(),
  environment: z.enum(["sandbox", "production"]),
  publicConfig: textRecord,
  secrets: textRecord,
});
const testSchema = z.object({ action: z.literal("test"), provider: providerSchema });

const allowedFields: Record<IntegrationProvider, { publicConfig: string[]; secrets: string[] }> = {
  mercado_pago: { publicConfig: ["publicKey"], secrets: ["accessToken", "webhookSecret"] },
  appmax: { publicConfig: ["externalId", "appId", "siteId", "softDescriptor"], secrets: ["clientId", "clientSecret"] },
  melhor_envio: { publicConfig: ["originPostalCode", "userAgentEmail"], secrets: ["token"] },
  google_merchant: { publicConfig: ["merchantId", "businessName"], secrets: [] },
  carrier_direct: { publicConfig: ["carrierType", "carrierName", "apiBaseUrl", "contractCode", "accountCode"], secrets: ["apiToken", "apiSecret"] },
  mercado_livre: { publicConfig: ["appId", "userId", "siteId", "nickname", "tokenExpiresAt"], secrets: ["clientSecret", "accessToken", "refreshToken"] },
  shopee: { publicConfig: ["partnerId", "shopId", "region", "shopName", "tokenExpiresAt"], secrets: ["partnerKey", "accessToken", "refreshToken"] },
  meta_conversions: { publicConfig: ["pixelId", "graphApiVersion", "testEventCode"], secrets: ["accessToken"] },
  google_ads: { publicConfig: ["conversionId", "purchaseLabel"], secrets: [] },
  focus_nfe: { publicConfig: ["issuerCnpj", "issuerState", "taxRegime", "natureOperation", "freightMode", "defaultCfop", "defaultNcm", "defaultUnit", "defaultOrigin", "defaultIcmsCst", "defaultPisCst", "defaultCofinsCst"], secrets: ["token", "webhookSecret"] },
  supabase: { publicConfig: ["projectUrl", "publishableKey"], secrets: ["secretKey", "databaseUrl"] },
};

function filterFields(values: Record<string, string>, allowed: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.includes(key)).map(([key, value]) => [key, value.trim()]));
}

function sessionFor(request: NextRequest) {
  return parseSession(request.cookies.get(adminCookie.name)?.value);
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin;
  return origin === expected;
}

function safeConfig(provider: IntegrationProvider) {
  const config = getRuntimeIntegrationConfig(provider);
  return {
    provider: config.provider,
    enabled: config.enabled,
    environment: config.environment,
    publicConfig: config.publicConfig,
    secretKeys: config.secretKeys,
    lastTestStatus: config.lastTestStatus,
    lastTestMessage: config.lastTestMessage,
    lastTestedAt: config.lastTestedAt,
    updatedAt: config.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  if (!sessionFor(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ integrations: listSafeRuntimeIntegrationConfigs() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "admin-integrations", 40, 10 * 60_000)) return NextResponse.json({ error: "Muitas alterações. Aguarde alguns minutos." }, { status: 429 });
  const session = sessionFor(request);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem da solicitação inválida" }, { status: 403 });
  try {
    const raw = await request.json() as { action?: unknown };
    if (raw?.action === "test") {
      const input = testSchema.parse(raw);
      const result = await testIntegrationConnection(input.provider);
      saveIntegrationTest(input.provider, result.ok ? "success" : "failed", result.message, session.email);
      return NextResponse.json({ ...result, config: safeConfig(input.provider) }, { status: result.ok ? 200 : 422 });
    }
    if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode alterar credenciais." }, { status: 403 });
    const input = saveSchema.parse(raw);
    const allowed = allowedFields[input.provider];
    const publicConfig = filterFields(input.publicConfig, allowed.publicConfig);
    const secrets = filterFields(input.secrets, allowed.secrets);
    if (input.provider === "carrier_direct" && publicConfig.apiBaseUrl && !/^https:\/\//i.test(publicConfig.apiBaseUrl)) {
      return NextResponse.json({ error: "A URL da transportadora precisa usar HTTPS." }, { status: 400 });
    }
    if (input.provider === "supabase" && publicConfig.projectUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(publicConfig.projectUrl)) {
      return NextResponse.json({ error: "Informe a URL do projeto no formato https://seu-projeto.supabase.co." }, { status: 400 });
    }
    if (input.enabled) {
      const current = getRuntimeIntegrationConfig(input.provider);
      const mergedSecrets = { ...current.secrets, ...Object.fromEntries(Object.entries(secrets).filter(([, value]) => value)) };
      const marketplaceCredentialsChanged = current.environment !== input.environment
        || JSON.stringify(current.publicConfig) !== JSON.stringify(publicConfig)
        || Object.values(secrets).some(Boolean);
      if (input.provider === "mercado_pago" && (!publicConfig.publicKey || !mergedSecrets.accessToken || !mergedSecrets.webhookSecret)) return NextResponse.json({ error: "Para habilitar o Mercado Pago, informe Public Key, Access Token e a assinatura secreta do webhook." }, { status: 400 });
      if (input.provider === "appmax") return NextResponse.json({ error: "Salve e teste a Appmax desabilitada. A ativação será liberada depois da homologação do checkout Appmax JS." }, { status: 400 });
      if (input.provider === "melhor_envio" && (!mergedSecrets.token || !/^\d{8}$/.test((publicConfig.originPostalCode || "").replace(/\D/g, "")))) return NextResponse.json({ error: "Para habilitar o Melhor Envio, informe o token e o CEP de origem." }, { status: 400 });
      if (input.provider === "google_merchant" && !publicConfig.merchantId) return NextResponse.json({ error: "Informe o ID do Merchant Center." }, { status: 400 });
      if (input.provider === "carrier_direct") return NextResponse.json({ error: "Salve o contrato desabilitado. A ativação será liberada após criar e homologar o adaptador desta transportadora." }, { status: 400 });
      if (input.provider === "mercado_livre" && (!publicConfig.appId || !mergedSecrets.clientSecret || !mergedSecrets.accessToken)) return NextResponse.json({ error: "Para habilitar o Mercado Livre, informe App ID, Client Secret e Access Token, depois teste a conexão." }, { status: 400 });
      if (input.provider === "shopee" && (!publicConfig.partnerId || !publicConfig.shopId || !mergedSecrets.partnerKey || !mergedSecrets.accessToken)) return NextResponse.json({ error: "Para habilitar a Shopee, informe Partner ID, Shop ID, Partner Key e Access Token, depois teste a conexão." }, { status: 400 });
      if (input.provider === "meta_conversions" && (!/^\d{5,30}$/.test(publicConfig.pixelId || "") || !mergedSecrets.accessToken)) return NextResponse.json({ error: "Para habilitar a Meta, informe um ID do Pixel válido e o token da API de Conversões." }, { status: 400 });
      if (input.provider === "google_ads" && (!/^AW-\d{5,30}$/.test(publicConfig.conversionId || "") || !/^[A-Za-z0-9_-]{5,100}$/.test(publicConfig.purchaseLabel || ""))) return NextResponse.json({ error: "Informe o ID no formato AW-123456789 e o rótulo da conversão de compra." }, { status: 400 });
      if (input.provider === "focus_nfe") {
        const validPublic = /^\d{14}$/.test((publicConfig.issuerCnpj || "").replace(/\D/g, ""))
          && /^[A-Za-z]{2}$/.test(publicConfig.issuerState || "")
          && /^[123]$/.test(publicConfig.taxRegime || "")
          && (publicConfig.natureOperation || "").length >= 3
          && /^(0|1|2|9)$/.test(publicConfig.freightMode || "");
        if (!validPublic || !mergedSecrets.token || !mergedSecrets.webhookSecret) return NextResponse.json({ error: "Para habilitar a emissão fiscal, informe CNPJ, UF, regime, natureza da operação, modalidade de frete, token e segredo do webhook." }, { status: 400 });
        const changed = current.environment !== input.environment || JSON.stringify(current.publicConfig) !== JSON.stringify(publicConfig) || Object.values(secrets).some(Boolean);
        if (current.lastTestStatus !== "success" || changed) return NextResponse.json({ error: "Salve com a emissão desabilitada, teste a conexão e depois habilite a configuração validada." }, { status: 400 });
      }
      if (input.provider === "supabase") return NextResponse.json({ error: "Teste e salve as credenciais desabilitadas. A ativação será liberada somente depois de migrar e validar todas as tabelas." }, { status: 400 });
      if (["mercado_livre", "shopee"].includes(input.provider) && (current.lastTestStatus !== "success" || marketplaceCredentialsChanged)) return NextResponse.json({ error: "Salve com a integração desabilitada, clique em Testar conexão e somente depois habilite a conta validada." }, { status: 400 });
    }
    saveIntegrationConfig({ provider: input.provider, enabled: input.enabled, environment: input.environment, publicConfig, secrets }, session.email);
    return NextResponse.json({ ok: true, config: safeConfig(input.provider) });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Confira os campos informados." : error instanceof Error ? error.message : "Não foi possível salvar a integração.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

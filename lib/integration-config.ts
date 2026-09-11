import "server-only";
import { getIntegrationConfig, integrationProviders, type IntegrationConfig, type IntegrationProvider } from "@/lib/database";

const environmentConfig: Partial<Record<IntegrationProvider, {
  environment?: "sandbox" | "production";
  publicConfig?: Record<string, string | undefined>;
  secrets?: Record<string, string | undefined>;
}>> = {
  mercado_pago: {
    environment: process.env.MERCADO_PAGO_MODE === "production" ? "production" : "sandbox",
    publicConfig: { publicKey: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY },
    secrets: { accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN, webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET },
  },
  appmax: {
    environment: process.env.APPMAX_MODE === "production" ? "production" : "sandbox",
    publicConfig: { externalId: process.env.NEXT_PUBLIC_APPMAX_EXTERNAL_ID, appId: process.env.APPMAX_APP_ID, siteId: process.env.APPMAX_SITE_ID, softDescriptor: process.env.APPMAX_SOFT_DESCRIPTOR },
    secrets: { clientId: process.env.APPMAX_CLIENT_ID, clientSecret: process.env.APPMAX_CLIENT_SECRET },
  },
  melhor_envio: {
    environment: process.env.MELHOR_ENVIO_MODE === "production" ? "production" : "sandbox",
    publicConfig: { originPostalCode: process.env.STORE_POSTAL_CODE, userAgentEmail: process.env.MELHOR_ENVIO_USER_AGENT },
    secrets: { token: process.env.MELHOR_ENVIO_TOKEN },
  },
  google_merchant: {
    environment: "production",
    publicConfig: { merchantId: process.env.GOOGLE_MERCHANT_ID },
  },
  mercado_livre: {
    environment: process.env.MERCADO_LIVRE_MODE === "sandbox" ? "sandbox" : "production",
    publicConfig: { appId: process.env.MERCADO_LIVRE_APP_ID, userId: process.env.MERCADO_LIVRE_USER_ID, siteId: process.env.MERCADO_LIVRE_SITE_ID || "MLB" },
    secrets: { clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET, accessToken: process.env.MERCADO_LIVRE_ACCESS_TOKEN, refreshToken: process.env.MERCADO_LIVRE_REFRESH_TOKEN },
  },
  shopee: {
    environment: process.env.SHOPEE_MODE === "sandbox" ? "sandbox" : "production",
    publicConfig: { partnerId: process.env.SHOPEE_PARTNER_ID, shopId: process.env.SHOPEE_SHOP_ID, region: process.env.SHOPEE_REGION || "BR" },
    secrets: { partnerKey: process.env.SHOPEE_PARTNER_KEY, accessToken: process.env.SHOPEE_ACCESS_TOKEN, refreshToken: process.env.SHOPEE_REFRESH_TOKEN },
  },
  meta_conversions: {
    environment: process.env.META_TEST_EVENT_CODE ? "sandbox" : "production",
    publicConfig: {
      pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
      graphApiVersion: process.env.META_GRAPH_API_VERSION || "v25.0",
      testEventCode: process.env.META_TEST_EVENT_CODE,
    },
    secrets: { accessToken: process.env.META_CONVERSIONS_API_TOKEN },
  },
  google_ads: {
    environment: "production",
    publicConfig: {
      conversionId: process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID,
      purchaseLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL,
    },
  },
  focus_nfe: {
    environment: process.env.FOCUS_NFE_MODE === "production" ? "production" : "sandbox",
    publicConfig: {
      issuerCnpj: process.env.FOCUS_NFE_ISSUER_CNPJ,
      issuerState: process.env.FOCUS_NFE_ISSUER_STATE,
      taxRegime: process.env.FOCUS_NFE_TAX_REGIME,
      natureOperation: process.env.FOCUS_NFE_NATURE_OPERATION,
      defaultCfop: process.env.FOCUS_NFE_DEFAULT_CFOP,
      defaultNcm: process.env.FOCUS_NFE_DEFAULT_NCM,
      defaultUnit: process.env.FOCUS_NFE_DEFAULT_UNIT,
      defaultOrigin: process.env.FOCUS_NFE_DEFAULT_ORIGIN,
      defaultIcmsCst: process.env.FOCUS_NFE_DEFAULT_ICMS_CST,
      defaultPisCst: process.env.FOCUS_NFE_DEFAULT_PIS_CST,
      defaultCofinsCst: process.env.FOCUS_NFE_DEFAULT_COFINS_CST,
      freightMode: process.env.FOCUS_NFE_FREIGHT_MODE,
    },
    secrets: { token: process.env.FOCUS_NFE_TOKEN, webhookSecret: process.env.FOCUS_NFE_WEBHOOK_SECRET },
  },
};

function compact(values?: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(values || {}).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0));
}

export async function getRuntimeIntegrationConfig(provider: IntegrationProvider): Promise<IntegrationConfig> {
  const stored = await getIntegrationConfig(provider);
  const env = environmentConfig[provider];
  const publicConfig = { ...compact(env?.publicConfig), ...(stored?.publicConfig || {}) };
  const secrets = { ...compact(env?.secrets), ...(stored?.secrets || {}) };
  const inferredEnabled = provider === "mercado_pago"
    ? Boolean(publicConfig.publicKey && secrets.accessToken)
    : provider === "appmax"
      ? false
      : provider === "melhor_envio"
        ? Boolean(secrets.token)
        : provider === "google_merchant"
          ? Boolean(publicConfig.merchantId)
          : provider === "mercado_livre"
            ? Boolean(publicConfig.appId && secrets.accessToken)
            : provider === "shopee"
              ? Boolean(publicConfig.partnerId && publicConfig.shopId && secrets.partnerKey && secrets.accessToken)
              : provider === "meta_conversions"
                ? Boolean(publicConfig.pixelId && secrets.accessToken)
                : provider === "google_ads"
                  ? Boolean(publicConfig.conversionId && publicConfig.purchaseLabel)
                  : provider === "focus_nfe"
                    ? false
                  : false;
  return {
    provider,
    enabled: stored ? stored.enabled : inferredEnabled,
    environment: stored?.environment || env?.environment || "sandbox",
    publicConfig,
    secrets,
    secretKeys: Object.keys(secrets),
    lastTestStatus: stored?.lastTestStatus || null,
    lastTestMessage: stored?.lastTestMessage || null,
    lastTestedAt: stored?.lastTestedAt || null,
    updatedAt: stored?.updatedAt || null,
  };
}

export async function listSafeRuntimeIntegrationConfigs() {
  return Promise.all(integrationProviders.map(async (provider) => {
    const config = await getRuntimeIntegrationConfig(provider);
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
  }));
}

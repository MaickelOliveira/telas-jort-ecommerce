import "server-only";
import { createHash } from "node:crypto";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";

export type MetaEventName = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

type MetaUserData = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

export type MetaConversionInput = {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl: string;
  userData: MetaUserData;
  customData?: Record<string, unknown>;
};

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
}

function hash(value?: string) {
  const normalized = value ? normalize(value) : "";
  return normalized ? createHash("sha256").update(normalized).digest("hex") : undefined;
}

function phone(value?: string) {
  const digits = value?.replace(/\D/g, "") || "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function hashedArray(value?: string) {
  const result = hash(value);
  return result ? [result] : undefined;
}

export async function sendMetaConversionEvent(input: MetaConversionInput) {
  const config = await getRuntimeIntegrationConfig("meta_conversions");
  const pixelId = config.publicConfig.pixelId;
  const accessToken = config.secrets.accessToken;
  if (!config.enabled || !pixelId || !accessToken) return { sent: false as const, reason: "disabled" };
  const version = /^v\d+\.\d+$/.test(config.publicConfig.graphApiVersion || "") ? config.publicConfig.graphApiVersion : "v25.0";
  const userData = Object.fromEntries(Object.entries({
    em: hashedArray(input.userData.email),
    ph: hashedArray(phone(input.userData.phone)),
    fn: hashedArray(input.userData.firstName),
    ln: hashedArray(input.userData.lastName),
    ct: hashedArray(input.userData.city),
    st: hashedArray(input.userData.state),
    zp: hashedArray(input.userData.postalCode?.replace(/\D/g, "")),
    country: hashedArray(input.userData.country || "br"),
    external_id: hashedArray(input.userData.externalId),
    fbp: input.userData.fbp,
    fbc: input.userData.fbc,
    client_ip_address: input.userData.clientIpAddress,
    client_user_agent: input.userData.clientUserAgent,
  }).filter(([, value]) => value !== undefined && value !== ""));
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events`);
  url.searchParams.set("access_token", accessToken);
  const body: Record<string, unknown> = {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      action_source: "website",
      event_source_url: input.eventSourceUrl,
      user_data: userData,
      ...(input.customData ? { custom_data: input.customData } : {}),
    }],
  };
  if (config.publicConfig.testEventCode) body.test_event_code = config.publicConfig.testEventCode;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({})) as { events_received?: number; error?: { message?: string } };
  if (!response.ok || !result.events_received) throw new Error(result.error?.message || `Meta CAPI respondeu HTTP ${response.status}`);
  return { sent: true as const };
}

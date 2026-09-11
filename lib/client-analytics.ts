export function getVisitorId() {
  if (typeof window === "undefined") return null;
  const existing = localStorage.getItem("tj_vid");
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("tj_vid", created);
  return created;
}

export function trackAnalytics(event: "add_to_cart" | "begin_checkout" | "purchase", metadata?: Record<string, string | number>) {
  const visitorId = getVisitorId();
  if (!visitorId) return;
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitorId, event, path: window.location.pathname, metadata }),
    keepalive: true,
  }).catch(() => undefined);
  if (event === "add_to_cart") trackMetaEvent("AddToCart", {
    content_ids: metadata?.productId ? [String(metadata.productId)] : undefined,
    content_type: "product",
    num_items: Number(metadata?.quantity || 1),
    currency: String(metadata?.currency || "BRL"),
    ...(typeof metadata?.value === "number" ? { value: metadata.value } : {}),
  });
  if (event === "add_to_cart") trackGoogleEvent("add_to_cart", {
    currency: String(metadata?.currency || "BRL"),
    value: typeof metadata?.value === "number" ? metadata.value : undefined,
    items: metadata?.productId ? [{ item_id: String(metadata.productId), quantity: Number(metadata?.quantity || 1) }] : undefined,
  });
  if (event === "begin_checkout") trackMetaEvent("InitiateCheckout", {
    num_items: Number(metadata?.itemCount || 1),
    currency: String(metadata?.currency || "BRL"),
    ...(typeof metadata?.value === "number" ? { value: metadata.value } : {}),
  });
  if (event === "begin_checkout") trackGoogleEvent("begin_checkout", { currency: String(metadata?.currency || "BRL"), value: metadata?.value, num_items: metadata?.itemCount });
}

export function trackGoogleEvent(eventName: string, parameters?: Record<string, unknown>) {
  if (typeof window === "undefined" || localStorage.getItem("tj_meta_consent") !== "granted" || !window.__TJ_GOOGLE_ADS_ID) return;
  window.gtag?.("event", eventName, parameters || {});
}

export function trackPurchaseConversions(input: { orderId: string; value: number; customer: { email: string; phone: string; name: string; address: string; city: string; state: string; postalCode: string }; metaEventId?: string }) {
  if (typeof window === "undefined" || localStorage.getItem("tj_meta_consent") !== "granted") return;
  if (window.__TJ_META_PIXEL_ID) trackMetaEvent("Purchase", { value: input.value, currency: "BRL", content_type: "product" }, input.metaEventId || `purchase-${input.orderId}`, false);
  if (window.__TJ_GOOGLE_ADS_ID && window.__TJ_GOOGLE_PURCHASE_LABEL) {
    const parts = input.customer.name.trim().split(/\s+/);
    window.gtag?.("set", "user_data", {
      email: input.customer.email,
      phone_number: input.customer.phone,
      address: { first_name: parts[0], last_name: parts.slice(1).join(" "), street: input.customer.address, city: input.customer.city, region: input.customer.state, postal_code: input.customer.postalCode, country: "BR" },
    });
    window.gtag?.("event", "conversion", { send_to: `${window.__TJ_GOOGLE_ADS_ID}/${window.__TJ_GOOGLE_PURCHASE_LABEL}`, value: input.value, currency: "BRL", transaction_id: input.orderId });
  }
}

export type BrowserMetaEventName = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase";

export function trackMetaEvent(eventName: BrowserMetaEventName, customData?: Record<string, unknown>, eventId = crypto.randomUUID(), server = true) {
  if (typeof window === "undefined" || localStorage.getItem("tj_meta_consent") !== "granted" || !window.__TJ_META_PIXEL_ID) return null;
  window.fbq?.("track", eventName, customData || {}, { eventID: eventId });
  if (server && eventName !== "Purchase") fetch("/api/meta/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consent: true, eventName, eventId, path: `${window.location.pathname}${window.location.search}`, customData }),
    keepalive: true,
  }).catch(() => undefined);
  return eventId;
}

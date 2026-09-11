import "server-only";
import { signValue, verifySignedValue } from "@/lib/security";
import type { CartItem } from "@/lib/types";

export type QuotePayload = { id: string; carrier: string; service: string; priceCents: number; deliveryDays: number; postalCode: string; cartHash: string; exp: number };
export function cartFingerprint(items: CartItem[]) {
  const normalized = items.map(({ productId, quantity, selection }) => ({ productId, quantity, lengthM: selection?.lengthM || null, heightM: selection?.heightM || null }));
  return signValue(JSON.stringify(normalized), "SHIPPING_QUOTE_SECRET").slice(0, 32);
}
export function createQuoteToken(payload: QuotePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded, "SHIPPING_QUOTE_SECRET")}`;
}
export function verifyQuoteToken(token: string, items: CartItem[]) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !verifySignedValue(encoded, signature, "SHIPPING_QUOTE_SECRET")) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as QuotePayload;
    return payload.exp > Date.now() && payload.cartHash === cartFingerprint(items) ? payload : null;
  } catch { return null; }
}

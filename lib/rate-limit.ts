import "server-only";
import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export function allowRequest(request: NextRequest, name: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  const key = `${name}:${clientIp(request)}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  current.count += 1;
  return current.count <= limit;
}

export function sameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const trustedOrigins = new Set<string>([request.nextUrl.origin]);
  if (process.env.APP_URL) {
    try { trustedOrigins.add(new URL(process.env.APP_URL).origin); } catch { /* invalid configuration is ignored */ }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  if (host && /^(https?|http)$/.test(protocol) && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) {
    try { trustedOrigins.add(new URL(`${protocol}://${host}`).origin); } catch { /* malformed proxy headers are ignored */ }
  }

  return trustedOrigins.has(origin);
}

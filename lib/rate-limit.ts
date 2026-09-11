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
  try {
    const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : request.nextUrl.origin;
    return origin === expected;
  } catch { return false; }
}

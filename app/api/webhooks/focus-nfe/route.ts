import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { finishWebhook, getFiscalDocumentByReference, startWebhook } from "@/lib/database";
import { getRuntimeIntegrationConfig } from "@/lib/integration-config";
import { syncFocusNfeWebhook } from "@/lib/integrations/focus-nfe";

export const runtime = "nodejs";

function sameSecret(expected: string, supplied: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const config = getRuntimeIntegrationConfig("focus_nfe");
  if (!config.enabled || !config.secrets.webhookSecret) return NextResponse.json({ received: false }, { status: 503 });
  const supplied = request.headers.get("authorization") || "";
  const expected = config.secrets.webhookSecret;
  if (!sameSecret(expected, supplied) && !sameSecret(`Bearer ${expected}`, supplied)) return NextResponse.json({ error: "Autorização inválida" }, { status: 401 });
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  if (!body) return NextResponse.json({ error: "Conteúdo inválido" }, { status: 400 });
  const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {};
  const reference = String(body.ref || body.referencia || body.reference || data.ref || data.referencia || "");
  if (!/^TJ-[A-Za-z0-9-]{3,80}$/.test(reference) || !getFiscalDocumentByReference(reference)) return NextResponse.json({ error: "Referência desconhecida" }, { status: 404 });
  const eventId = `${reference}:${createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 24)}`;
  if (!startWebhook("focus_nfe", eventId)) return NextResponse.json({ received: true, duplicate: true });
  try {
    const status = syncFocusNfeWebhook(reference, { ...data, ...body } as Parameters<typeof syncFocusNfeWebhook>[1]);
    finishWebhook("focus_nfe", eventId, "processed");
    return NextResponse.json({ received: true, status });
  } catch {
    finishWebhook("focus_nfe", eventId, "failed");
    return NextResponse.json({ error: "Falha temporária" }, { status: 500 });
  }
}

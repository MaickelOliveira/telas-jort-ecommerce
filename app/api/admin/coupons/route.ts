import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { deleteCoupon, listCoupons, saveCoupon } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const codeSchema = z.string().trim().min(3).max(30).regex(/^[a-z0-9_-]+$/i).transform((value) => value.toUpperCase());
const saveSchema = z.object({
  action: z.literal("save"),
  code: codeSchema,
  kind: z.enum(["percentage", "fixed"]),
  value: z.number().int().positive().max(100_000_000),
  minimumCents: z.number().int().min(0).max(100_000_000),
  expiresAt: z.union([z.string().datetime(), z.null()]),
  active: z.boolean(),
}).superRefine((input, context) => {
  if (input.kind === "percentage" && input.value > 100) context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "O desconto percentual não pode passar de 100%." });
});
const deleteSchema = z.object({ action: z.literal("delete"), code: codeSchema });

function sessionFor(request: NextRequest) {
  return parseSession(request.cookies.get(adminCookie.name)?.value);
}

export async function GET(request: NextRequest) {
  if (!sessionFor(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ coupons: await listCoupons() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "admin-coupons", 40, 10 * 60_000)) return NextResponse.json({ error: "Muitas alterações. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = sessionFor(request);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode alterar cupons." }, { status: 403 });
  try {
    const raw = await request.json() as { action?: unknown };
    if (raw.action === "delete") {
      const input = deleteSchema.parse(raw);
      await deleteCoupon(input.code, session.email);
      return NextResponse.json({ ok: true, coupons: await listCoupons() });
    }
    const input = saveSchema.parse(raw);
    const coupon = await saveCoupon(input, session.email);
    return NextResponse.json({ ok: true, coupon, coupons: await listCoupons() });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Confira os dados do cupom." : "Não foi possível salvar o cupom.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

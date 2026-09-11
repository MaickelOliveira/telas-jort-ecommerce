import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { saveStoreSettings } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  cnpj: z.string().trim().min(14).max(24),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(10).max(30),
  whatsapp: z.string().regex(/^\d{10,15}$/),
  postalCode: z.string().trim().min(8).max(10),
  address: z.string().trim().min(3).max(180),
  number: z.string().trim().min(1).max(30),
  district: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  instagram: z.union([z.literal(""), z.string().url().startsWith("https://").max(300)]),
  largeOrderQuantityThreshold: z.union([z.literal(""), z.string().regex(/^\d{1,6}$/)]),
}).strict();

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "admin-settings", 30, 10 * 60_000)) return NextResponse.json({ error: "Muitas alterações. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode alterar estes dados." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    await saveStoreSettings(input, session.email);
    return NextResponse.json({ ok: true, settings: input });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Confira os dados informados." : "Não foi possível salvar." }, { status: 400 });
  }
}

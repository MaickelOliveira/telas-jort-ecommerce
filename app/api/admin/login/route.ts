import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, authenticateAdmin, checkLoginRateLimit, createSession } from "@/lib/admin-auth";
import { audit } from "@/lib/database";

export const runtime = "nodejs";
const schema = z.union([z.object({ demo: z.literal(true) }), z.object({ email: z.string().email().max(160), password: z.string().min(1).max(256) })]);
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!checkLoginRateLimit(ip)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });
  try {
    const input = schema.parse(await request.json());
    const demoAllowed = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_ADMIN === "true";
    const demo = "demo" in input;
    if (demo && !demoAllowed) return NextResponse.json({ error: "Demonstração desativada." }, { status: 403 });
    if (!("demo" in input) && !authenticateAdmin(input.email, input.password)) {
      audit("anonymous", "admin.login_failed");
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    const email = "demo" in input ? "demonstracao@telasjort.local" : input.email.toLowerCase();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminCookie.name, createSession(email, demo ? "demo" : "owner"), adminCookie.options);
    audit(email, "admin.login_success");
    return response;
  } catch { return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 }); }
}

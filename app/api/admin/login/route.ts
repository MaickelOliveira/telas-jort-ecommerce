import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, authenticateAdmin, checkLoginRateLimit, createSession } from "@/lib/admin-auth";
import { audit } from "@/lib/database";

export const runtime = "nodejs";
const schema = z.union([z.object({ demo: z.literal(true) }), z.object({ email: z.string().trim().email().max(160), password: z.string().min(1).max(256) })]);
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!checkLoginRateLimit(ip)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Informe um e-mail válido e a senha." }, { status: 400 });
  }

  try {
    const demoAllowed = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_ADMIN === "true";
    const demo = "demo" in input;
    if (demo && !demoAllowed) return NextResponse.json({ error: "Demonstração desativada." }, { status: 403 });
    if (!("demo" in input) && !authenticateAdmin(input.email, input.password)) {
      try { await audit("anonymous", "admin.login_failed"); } catch (error) { console.error("[admin-login] Falha ao gravar auditoria de acesso negado", error); }
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    const email = "demo" in input ? "demonstracao@telasjort.local" : input.email.toLowerCase();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(adminCookie.name, createSession(email, demo ? "demo" : "owner"), adminCookie.options);
    try { await audit(email, "admin.login_success"); } catch (error) { console.error("[admin-login] Falha ao gravar auditoria de acesso autorizado", error); }
    return response;
  } catch (error) {
    console.error("[admin-login] Não foi possível criar a sessão administrativa", error);
    return NextResponse.json({ error: "O acesso foi validado, mas o servidor não conseguiu iniciar a sessão. Confira a configuração do serviço." }, { status: 503 });
  }
}

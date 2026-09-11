import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCustomerSession, customerCookie } from "@/lib/customer-auth";
import { audit, getCustomerAccountByEmail } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/security";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(160), password: z.string().min(1).max(256) }).strict();

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "customer-login", 10, 15 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const customer = getCustomerAccountByEmail(input.email);
    if (!customer || !verifyPassword(input.password, customer.password_hash)) {
      audit(input.email.toLowerCase(), "customer.login_failed");
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(customerCookie.name, createCustomerSession(customer.id, customer.email), customerCookie.options);
    audit(customer.email, "customer.login_success", customer.id);
    return response;
  } catch {
    return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }
}

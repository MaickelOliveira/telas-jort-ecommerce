import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCustomerSession, customerCookie } from "@/lib/customer-auth";
import { createCustomerAccount, getCustomerAccountByEmail } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120),
  email: z.string().trim().email("Informe um e-mail válido.").max(160).transform((value) => value.toLowerCase()),
  phone: z.string().trim().refine((value) => value.replace(/\D/g, "").length >= 10, "Informe um telefone válido.").transform((value) => value.replace(/\D/g, "").slice(0, 15)),
  password: z.string().min(12, "A senha precisa ter pelo menos 12 caracteres.").max(256),
}).strict();

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "customer-register", 8, 30 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    if (await getCustomerAccountByEmail(input.email)) return NextResponse.json({ error: "Este e-mail já possui cadastro. Entre com sua senha." }, { status: 409 });
    const customer = await createCustomerAccount({ ...input, passwordHash: hashPassword(input.password) });
    const response = NextResponse.json({ ok: true, customer: { name: customer.name, email: customer.email } });
    response.cookies.set(customerCookie.name, createCustomerSession(customer.id, customer.email), customerCookie.options);
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Confira os dados do cadastro." : "Não foi possível criar sua conta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

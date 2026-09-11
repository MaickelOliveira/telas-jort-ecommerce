import { NextRequest, NextResponse } from "next/server";
import { customerCookie } from "@/lib/customer-auth";
import { sameOriginRequest } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(customerCookie.name, "", { ...customerCookie.options, maxAge: 0 });
  return response;
}

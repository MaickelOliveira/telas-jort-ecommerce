import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Este endpoint mede apenas a saúde do processo web. Consultar um serviço
  // externo aqui faz o container oscilar entre healthy/unhealthy sempre que o
  // Supabase leva alguns segundos a mais para responder.
  return NextResponse.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
}

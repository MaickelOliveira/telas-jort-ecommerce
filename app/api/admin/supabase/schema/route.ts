import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { adminCookie, parseSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const sql = await readFile(path.join(process.cwd(), "db", "supabase-schema.sql"), "utf8");
  return new NextResponse(sql, {
    headers: {
      "content-type": "application/sql; charset=utf-8",
      "content-disposition": "attachment; filename=\"telas-jort-supabase.sql\"",
      "cache-control": "private, no-store",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminCookie, parseSession } from "@/lib/admin-auth";
import { saveProductConfig } from "@/lib/database";
import { allowRequest, sameOriginRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const optionalPositive = (max = 10_000_000) => z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().positive().max(max).optional());
const optionalNonnegative = (max = 10_000_000) => z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().nonnegative().max(max).optional());
const schema = z.object({
  id: z.string().max(120).optional(), name: z.string().trim().min(3).max(180), sku: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(80), subcategory: z.string().trim().max(80).optional(),
  metaDescription: z.string().trim().max(300).optional(), descriptionText: z.string().trim().max(10_000).optional(),
  mode: z.enum(["unit", "fixed_roll", "linear_meter", "square_meter"]),
  price: z.coerce.number().positive().max(10_000_000), comparePrice: optionalNonnegative(),
  inventory: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().int().nonnegative().max(10_000_000).optional()), kgPerUnit: optionalPositive(100_000),
  kgPerLinearM: optionalPositive(100_000), kgPerSquareM: optionalPositive(100_000), fixedHeightM: optionalPositive(100),
  customerChoosesHeight: z.boolean().default(false), minHeightM: optionalPositive(100), maxHeightM: optionalPositive(100), heightStepM: optionalPositive(100),
  minLengthM: optionalPositive(10_000), maxLengthM: optionalPositive(10_000), lengthStepM: optionalPositive(100),
  packagingKg: optionalNonnegative(100_000), packageLengthCm: optionalPositive(100_000),
  packageDiameterBaseCm: optionalPositive(100_000), packageDiameterGrowth: optionalNonnegative(10_000),
  ncm: z.string().regex(/^\d{8}$/).or(z.literal("")).optional(), cest: z.string().regex(/^\d{7}$/).or(z.literal("")).optional(),
  cfop: z.string().regex(/^\d{4}$/).or(z.literal("")).optional(), fiscalUnit: z.string().trim().regex(/^[A-Za-z0-9]{1,6}$/).or(z.literal("")).optional(),
  fiscalOrigin: z.string().regex(/^[0-8]$/).or(z.literal("")).optional(), icmsCst: z.string().trim().regex(/^[A-Za-z0-9_]{2,12}$/).or(z.literal("")).optional(),
  pisCst: z.string().regex(/^\d{2}$/).or(z.literal("")).optional(), cofinsCst: z.string().regex(/^\d{2}$/).or(z.literal("")).optional(),
  active: z.boolean().default(true), freightVerified: z.boolean().default(false),
}).strict();

export async function POST(request: NextRequest) {
  if (!allowRequest(request, "admin-products", 120, 10 * 60_000)) return NextResponse.json({ error: "Muitas alterações. Aguarde alguns minutos." }, { status: 429 });
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Origem da solicitação inválida" }, { status: 403 });
  const session = parseSession(request.cookies.get(adminCookie.name)?.value);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const id = input.id || input.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    saveProductConfig(id, input, session.email);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Confira os campos obrigatórios e os valores informados." : "Não foi possível salvar." }, { status: 400 });
  }
}

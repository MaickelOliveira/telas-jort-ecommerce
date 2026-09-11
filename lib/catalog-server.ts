import "server-only";
import { products as seedProducts } from "@/lib/catalog";
import { listProductConfigs } from "@/lib/database";
import type { MeasurementConfig, SaleMode, StoreProduct } from "@/lib/types";

function numberValue(value: unknown, fallback?: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "on" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

function optionalCents(value: unknown) {
  const number = numberValue(value);
  return number === undefined ? undefined : Math.round(number * 100);
}

function descriptionToHtml(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const escaped = value.trim().replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}

function mergeProduct(base: StoreProduct | undefined, id: string, config: Record<string, unknown>): StoreProduct {
  const mode = (["unit", "fixed_roll", "linear_meter", "square_meter"] as SaleMode[]).includes(config.mode as SaleMode)
    ? config.mode as SaleMode
    : base?.measurement.mode || "unit";
  const priceCents = Math.round((numberValue(config.price, (base?.measurement.pricePerUnitCents || 0) / 100) || 0) * 100);
  const measurement: MeasurementConfig = {
    ...(base?.measurement || { mode, pricePerUnitCents: priceCents, freightVerified: false }),
    mode,
    pricePerUnitCents: priceCents,
    kgPerUnit: numberValue(config.kgPerUnit, base?.measurement.kgPerUnit),
    kgPerLinearM: numberValue(config.kgPerLinearM, base?.measurement.kgPerLinearM),
    kgPerSquareM: numberValue(config.kgPerSquareM, base?.measurement.kgPerSquareM),
    fixedHeightM: numberValue(config.fixedHeightM, base?.measurement.fixedHeightM),
    customerChoosesHeight: booleanValue(config.customerChoosesHeight, base?.measurement.customerChoosesHeight || false),
    minHeightM: numberValue(config.minHeightM, base?.measurement.minHeightM),
    maxHeightM: numberValue(config.maxHeightM, base?.measurement.maxHeightM),
    heightStepM: numberValue(config.heightStepM, base?.measurement.heightStepM),
    minLengthM: numberValue(config.minLengthM, base?.measurement.minLengthM),
    maxLengthM: numberValue(config.maxLengthM, base?.measurement.maxLengthM),
    lengthStepM: numberValue(config.lengthStepM, base?.measurement.lengthStepM),
    packagingKg: numberValue(config.packagingKg, base?.measurement.packagingKg),
    packageLengthCm: numberValue(config.packageLengthCm, base?.measurement.packageLengthCm),
    packageDiameterBaseCm: numberValue(config.packageDiameterBaseCm, base?.measurement.packageDiameterBaseCm),
    packageDiameterGrowth: numberValue(config.packageDiameterGrowth, base?.measurement.packageDiameterGrowth),
    freightVerified: booleanValue(config.freightVerified, base?.measurement.freightVerified || false),
  };
  const image = base?.image || "/assets/images/storefront/category-telas.webp";
  return {
    id,
    slug: id,
    sku: String(config.sku || base?.sku || `TJ-${id.toUpperCase().slice(0, 16)}`),
    name: String(config.name || base?.name || "Novo produto"),
    category: String(config.category || base?.category || "Outros"),
    subcategory: String(config.subcategory || base?.subcategory || "Geral"),
    descriptionHtml: descriptionToHtml(config.descriptionText) || base?.descriptionHtml || "<p>Consulte nossa equipe para informações técnicas deste produto.</p>",
    metaDescription: String(config.metaDescription || base?.metaDescription || config.name || "Produto Telas Jort"),
    image,
    images: base?.images?.length ? base.images : [image],
    priceCents,
    compareAtPriceCents: optionalCents(config.comparePrice) ?? base?.compareAtPriceCents,
    inventory: numberValue(config.inventory, base?.inventory ?? undefined) ?? null,
    weightKg: numberValue(config.kgPerUnit, base?.weightKg) || numberValue(config.kgPerLinearM) || numberValue(config.kgPerSquareM) || 0.1,
    active: booleanValue(config.active, base?.active ?? true),
    measurement,
    fiscal: {
      ncm: String(config.ncm || base?.fiscal?.ncm || ""),
      cest: String(config.cest || base?.fiscal?.cest || ""),
      cfop: String(config.cfop || base?.fiscal?.cfop || ""),
      unit: String(config.fiscalUnit || base?.fiscal?.unit || ""),
      origin: String(config.fiscalOrigin || base?.fiscal?.origin || ""),
      icmsCst: String(config.icmsCst || base?.fiscal?.icmsCst || ""),
      pisCst: String(config.pisCst || base?.fiscal?.pisCst || ""),
      cofinsCst: String(config.cofinsCst || base?.fiscal?.cofinsCst || ""),
    },
  };
}

export async function getRuntimeProducts() {
  const result = new Map(seedProducts.map((product) => [product.id, product]));
  for (const stored of await listProductConfigs()) result.set(stored.productId, mergeProduct(result.get(stored.productId), stored.productId, stored.config));
  return [...result.values()];
}

export async function getRuntimeProduct(slug: string) {
  return (await getRuntimeProducts()).find((product) => product.slug === slug || product.id === slug);
}

export async function getRuntimeProductsByCategory(category?: string) {
  const products = (await getRuntimeProducts()).filter((product) => product.active);
  return !category || category === "Todos" ? products : products.filter((product) => product.category === category);
}

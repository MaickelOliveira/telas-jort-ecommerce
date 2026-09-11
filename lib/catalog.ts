import rawCatalog from "@/data/catalog.json";
import type { MeasurementConfig, StoreProduct } from "@/lib/types";

type RawProduct = {
  handle: string;
  title: string;
  sku?: string;
  category_path?: string[];
  description_html?: string;
  meta_description?: string;
  local_images?: string[];
  price: number;
  compare_at_price?: number | null;
  inventory?: number | null;
  weight_kg?: number;
};

const overrides: Record<string, Partial<MeasurementConfig>> = {
  "tela-soldada-5x10-1-5mt": {
    mode: "linear_meter", pricePerUnitCents: 1000, fixedHeightM: 1.5,
    minLengthM: 1, maxLengthM: 25, lengthStepM: 0.5,
    kgPerLinearM: 0.928, packagingKg: 0.7, packageLengthCm: 150,
    packageDiameterBaseCm: 18, packageDiameterGrowth: 1.8, freightVerified: false,
  },
  "tela-soldada-5x10-1-mt": {
    mode: "linear_meter", pricePerUnitCents: 700, fixedHeightM: 1,
    minLengthM: 1, maxLengthM: 25, lengthStepM: 0.5,
    kgPerLinearM: 0.624, packagingKg: 0.6, packageLengthCm: 100,
    packageDiameterBaseCm: 18, packageDiameterGrowth: 1.8, freightVerified: false,
  },
  "tela-soldada-25x25-1-mt": {
    mode: "linear_meter", pricePerUnitCents: 800, fixedHeightM: 1,
    minLengthM: 1, maxLengthM: 25, lengthStepM: 0.5,
    kgPerLinearM: 0.736, packagingKg: 0.6, packageLengthCm: 100,
    packageDiameterBaseCm: 18, packageDiameterGrowth: 1.9, freightVerified: false,
  },
  "tela-soldada-25x25-50cm": {
    mode: "linear_meter", pricePerUnitCents: 440, fixedHeightM: 0.5,
    minLengthM: 1, maxLengthM: 25, lengthStepM: 0.5,
    kgPerLinearM: 0.376, packagingKg: 0.5, packageLengthCm: 50,
    packageDiameterBaseCm: 18, packageDiameterGrowth: 1.9, freightVerified: false,
  },
  "arame-liso-galvanizado-vendido-por-kg": {
    mode: "unit", pricePerUnitCents: 1200, kgPerUnit: 1, packagingKg: 0.08, freightVerified: false,
  },
};

const asCents = (value?: number | null) => Math.round(Number(value || 0) * 100);

function productFromRaw(raw: RawProduct): StoreProduct {
  const images = (raw.local_images || []).map((path) => `/assets/${path}`);
  const baseMeasurement: MeasurementConfig = {
    mode: raw.category_path?.[0] === "Telas" ? "fixed_roll" : "unit",
    pricePerUnitCents: asCents(raw.price),
    kgPerUnit: Number(raw.weight_kg || 0.1),
    packagingKg: 0.1,
    freightVerified: false,
  };
  return {
    id: raw.handle,
    slug: raw.handle,
    sku: raw.sku || `TJ-${raw.handle.toUpperCase().slice(0, 16)}`,
    name: raw.title,
    category: raw.category_path?.[0] || "Outros",
    subcategory: raw.category_path?.[1] || "Geral",
    descriptionHtml: raw.description_html || "",
    metaDescription: raw.meta_description || raw.title,
    image: images[0] || "/assets/images/storefront/category-telas.webp",
    images,
    priceCents: asCents(raw.price),
    compareAtPriceCents: raw.compare_at_price ? asCents(raw.compare_at_price) : undefined,
    inventory: raw.inventory ?? null,
    weightKg: Number(raw.weight_kg || 0.1),
    active: true,
    measurement: { ...baseMeasurement, ...(overrides[raw.handle] || {}) },
  };
}

export const products: StoreProduct[] = (rawCatalog as RawProduct[]).map(productFromRaw);
export function getProduct(slug: string) { return products.find((product) => product.slug === slug); }
export function getProductsByCategory(category?: string) {
  return !category || category === "Todos" ? products : products.filter((product) => product.category === category);
}
export const categories = ["Todos", "Telas", "Arames", "Acessórios", "Ferramentas", "EPIs"];

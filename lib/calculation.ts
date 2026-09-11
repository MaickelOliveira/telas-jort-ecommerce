import { products as seedProducts } from "@/lib/catalog";
import type { CalculatedLine, CartItem, StoreProduct } from "@/lib/types";

const ceilToStep = (value: number, step: number) => Math.ceil((value / step) - 1e-9) * step;
function bounded(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Medida fora do intervalo permitido (${min} a ${max}).`);
  return value;
}

export function calculateProductLine(product: StoreProduct, quantity = 1, selection: { lengthM?: number; heightM?: number } = {}, lineId = product.id): CalculatedLine {
  const config = product.measurement;
  const safeQuantity = Math.max(1, Math.min(999, Math.floor(quantity || 1)));
  let billedLengthM: number | undefined;
  let billedHeightM: number | undefined;
  let billedAreaM2: number | undefined;
  let unitPriceCents = config.pricePerUnitCents;
  let weightKg = Number(config.kgPerUnit ?? product.weightKg) * safeQuantity;

  if (config.mode === "linear_meter" || config.mode === "square_meter") {
    const step = config.lengthStepM ?? 0.1;
    billedLengthM = Number(ceilToStep(bounded(Number(selection.lengthM), config.minLengthM ?? 0.5, config.maxLengthM ?? 100), step).toFixed(3));
    billedHeightM = config.customerChoosesHeight
      ? Number(ceilToStep(bounded(Number(selection.heightM), config.minHeightM ?? 0.5, config.maxHeightM ?? 4), config.heightStepM ?? 0.1).toFixed(3))
      : Number(config.fixedHeightM ?? 1);
    if (config.mode === "linear_meter") {
      unitPriceCents = Math.round(billedLengthM * config.pricePerUnitCents);
      weightKg = billedLengthM * Number(config.kgPerLinearM ?? 0) * safeQuantity;
    } else {
      billedAreaM2 = Number((billedLengthM * billedHeightM).toFixed(3));
      unitPriceCents = Math.round(billedAreaM2 * config.pricePerUnitCents);
      weightKg = billedAreaM2 * Number(config.kgPerSquareM ?? 0) * safeQuantity;
    }
  }
  weightKg += Number(config.packagingKg || 0);
  return {
    lineId, product, quantity: safeQuantity, selection, billedLengthM, billedHeightM, billedAreaM2,
    unitPriceCents, subtotalCents: unitPriceCents * safeQuantity,
    weightKg: Number(Math.max(weightKg, 0.01).toFixed(3)),
  };
}

export function calculateCart(items: CartItem[], catalog: StoreProduct[] = seedProducts) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new Error("O carrinho está vazio ou ultrapassou o limite de itens.");
  const lines = items.map((item) => {
    const product = catalog.find((candidate) => candidate.id === item.productId || candidate.slug === item.productId);
    if (!product || !product.active) throw new Error("Um produto do carrinho não está disponível.");
    return calculateProductLine(product, item.quantity, item.selection, item.lineId);
  });
  return {
    lines,
    subtotalCents: lines.reduce((sum, line) => sum + line.subtotalCents, 0),
    totalWeightKg: Number(lines.reduce((sum, line) => sum + line.weightKg, 0).toFixed(3)),
  };
}

export function packageForLine(line: CalculatedLine) {
  const config = line.product.measurement;
  if (config.mode === "linear_meter" || config.mode === "square_meter") {
    const diameter = Math.ceil(Number(config.packageDiameterBaseCm || 18) + Math.sqrt(line.billedLengthM || 1) * Number(config.packageDiameterGrowth || 2));
    return {
      length: Math.ceil(Number(config.packageLengthCm || (line.billedHeightM || 1) * 100)),
      width: diameter,
      height: diameter,
      weight: line.weightKg,
    };
  }
  if (line.product.category === "Arames") return { length: 35, width: 35, height: 22, weight: line.weightKg };
  return { length: 25, width: 20, height: 15, weight: line.weightKg };
}

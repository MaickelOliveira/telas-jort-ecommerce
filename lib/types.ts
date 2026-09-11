export type SaleMode = "unit" | "linear_meter" | "square_meter" | "fixed_roll";

export type MeasurementConfig = {
  mode: SaleMode;
  pricePerUnitCents: number;
  fixedHeightM?: number;
  customerChoosesHeight?: boolean;
  minHeightM?: number;
  maxHeightM?: number;
  heightStepM?: number;
  minLengthM?: number;
  maxLengthM?: number;
  lengthStepM?: number;
  kgPerUnit?: number;
  kgPerLinearM?: number;
  kgPerSquareM?: number;
  packagingKg?: number;
  packageLengthCm?: number;
  packageDiameterBaseCm?: number;
  packageDiameterGrowth?: number;
  freightVerified?: boolean;
};

export type FiscalProductConfig = {
  ncm?: string;
  cest?: string;
  cfop?: string;
  unit?: string;
  origin?: string;
  icmsCst?: string;
  pisCst?: string;
  cofinsCst?: string;
};

export type StoreProduct = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  descriptionHtml: string;
  metaDescription: string;
  image: string;
  images: string[];
  priceCents: number;
  compareAtPriceCents?: number;
  inventory: number | null;
  weightKg: number;
  active: boolean;
  measurement: MeasurementConfig;
  fiscal?: FiscalProductConfig;
};

export type CartSelection = { lengthM?: number; heightM?: number };
export type CartItem = { lineId: string; productId: string; quantity: number; selection?: CartSelection };
export type CalculatedLine = {
  lineId: string;
  product: StoreProduct;
  quantity: number;
  selection?: CartSelection;
  billedLengthM?: number;
  billedHeightM?: number;
  billedAreaM2?: number;
  unitPriceCents: number;
  subtotalCents: number;
  weightKg: number;
};
export type ShippingOption = {
  id: string;
  carrier: string;
  service: string;
  priceCents: number;
  deliveryDays: number;
  quoteToken: string;
  source: "melhor_envio" | "pickup" | "demo";
};

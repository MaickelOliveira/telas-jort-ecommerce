"use client";

import { createContext, useContext, useMemo } from "react";
import type { StoreProduct } from "@/lib/types";

type CatalogContextValue = { products: StoreProduct[]; getProduct: (id: string) => StoreProduct | undefined };
const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ products, children }: { products: StoreProduct[]; children: React.ReactNode }) {
  const value = useMemo(() => ({ products, getProduct: (id: string) => products.find((product) => product.id === id || product.slug === id) }), [products]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog deve ser usado dentro de CatalogProvider");
  return context;
}

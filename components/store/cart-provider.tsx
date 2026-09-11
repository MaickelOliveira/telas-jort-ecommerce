"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trackAnalytics } from "@/lib/client-analytics";
import type { CartItem, CartSelection } from "@/lib/types";

const STORAGE_KEY = "telas-jort-cart-v2";

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  addItem: (productId: string, quantity?: number, selection?: CartSelection) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(parsed)) setItems(parsed.slice(0, 50));
      } catch { localStorage.removeItem(STORAGE_KEY); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const addItem = useCallback((productId: string, quantity = 1, selection?: CartSelection) => {
    const lineId = `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [...current, { lineId, productId, quantity: Math.max(1, Math.floor(quantity)), selection }].slice(-50));
    trackAnalytics("add_to_cart", { productId, quantity });
    toast.success("Produto adicionado ao carrinho");
  }, []);
  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((current) => current.map((item) => item.lineId === lineId ? { ...item, quantity: Math.max(1, Math.min(999, Math.floor(quantity))) } : item));
  }, []);
  const removeItem = useCallback((lineId: string) => setItems((current) => current.filter((item) => item.lineId !== lineId)), []);
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const value = useMemo(() => ({ items, ready, count, addItem, updateQuantity, removeItem, clear }), [items, ready, count, addItem, updateQuantity, removeItem, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider");
  return context;
}

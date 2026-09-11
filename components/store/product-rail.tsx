"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { ProductCard } from "@/components/store/product-card";
import type { StoreProduct } from "@/lib/types";

export function ProductRail({ products }: { products: StoreProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.82, 240),
      behavior: "smooth",
    });
  };

  return (
    <div className="tj-product-rail">
      <div className="tj-product-rail__track" ref={trackRef}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <button
        className="tj-round-arrow tj-rail__arrow--prev"
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Produtos anteriores"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        className="tj-round-arrow tj-rail__arrow--next"
        type="button"
        onClick={() => scroll(1)}
        aria-label="Próximos produtos"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

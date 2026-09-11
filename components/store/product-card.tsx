"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/store/cart-provider";
import { money } from "@/lib/format";
import type { StoreProduct } from "@/lib/types";

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const measured = product.measurement.mode === "linear_meter" || product.measurement.mode === "square_meter";
  const currentPrice = product.measurement.pricePerUnitCents;
  const comparePrice = product.compareAtPriceCents;
  const discount = comparePrice && comparePrice > currentPrice
    ? Math.round((1 - currentPrice / comparePrice) * 100)
    : 0;
  const measurementLabel = product.measurement.mode === "linear_meter"
    ? "Preço por metro"
    : product.measurement.mode === "square_meter"
      ? "Preço por m²"
      : "";

  return (
    <article className="tj-product-card">
      <Link className="tj-product-card__media" href={`/produto/${product.slug}`}>
        {discount > 0 && (
          <span className="tj-product-card__discount-badge">
            {discount}% de desconto
          </span>
        )}
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 749px) 72vw, 240px"
        />
      </Link>
      <div className="tj-product-card__content">
        <Link className="tj-product-card__title" href={`/produto/${product.slug}`}>
          {product.name}
        </Link>
        {measurementLabel && (
          <span className="tj-product-card__measurement-label">{measurementLabel}</span>
        )}
        <div className="tj-price">
          <div className="tj-price__row">
            <strong className="tj-price__current">{money(currentPrice)}</strong>
            {comparePrice && comparePrice > currentPrice && (
              <s className="tj-price__compare">{money(comparePrice)}</s>
            )}
          </div>
          <span className="tj-price__installments">
            ou 12x de {money(Math.round(currentPrice / 12))}
          </span>
        </div>
        <div className="tj-product-card__action">
          {measured ? (
            <Link className="tj-button tj-button--accent tj-button--full" href={`/produto/${product.slug}`}>
              Calcular metros
            </Link>
          ) : (
            <button
              className="tj-button tj-button--accent tj-button--full"
              type="button"
              onClick={() => addItem(product.id)}
            >
              Comprar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

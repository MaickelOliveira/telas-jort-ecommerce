"use client";

import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/store/cart-provider";
import { calculateProductLine } from "@/lib/calculation";
import { money, numberPt } from "@/lib/format";
import type { StoreProduct } from "@/lib/types";
import { trackGoogleEvent, trackMetaEvent } from "@/lib/client-analytics";

export function ProductPurchase({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const config = product.measurement;
  const measured = config.mode === "linear_meter" || config.mode === "square_meter";
  const [quantity, setQuantity] = useState(1);
  const [lengthM, setLengthM] = useState(config.minLengthM || 1);
  const [heightM, setHeightM] = useState(config.fixedHeightM || config.minHeightM || 1);
  const calculation = useMemo(() => {
    try {
      return calculateProductLine(product, quantity, { lengthM, heightM });
    } catch {
      return null;
    }
  }, [product, quantity, lengthM, heightM]);
  const comparePrice = product.compareAtPriceCents;
  const discount = comparePrice && comparePrice > config.pricePerUnitCents
    ? Math.round((1 - config.pricePerUnitCents / comparePrice) * 100)
    : 0;
  const saleLabel = config.mode === "square_meter" ? "Venda por metro quadrado" : "Venda por metro corrido";
  const priceLabel = config.mode === "square_meter" ? "por m²" : measured ? "por metro corrido" : "por unidade";

  const updateQuantity = (value: number) => setQuantity(Math.max(1, Math.min(999, value || 1)));

  useEffect(() => {
    const event = { content_ids: [product.id], content_name: product.name, content_category: product.category, content_type: "product", value: product.measurement.pricePerUnitCents / 100, currency: "BRL" };
    trackMetaEvent("ViewContent", event);
    trackGoogleEvent("view_item", { currency: "BRL", value: product.measurement.pricePerUnitCents / 100, items: [{ item_id: product.id, item_name: product.name, item_category: product.category, price: product.measurement.pricePerUnitCents / 100, quantity: 1 }] });
  }, [product.id, product.name, product.category, product.measurement.pricePerUnitCents]);

  return (
    <div className="tj-product-info">
      <h1>{product.name}</h1>
      <div className="tj-product-sku">SKU: {product.sku}</div>

      <div className="tj-price tj-product-price">
        {discount > 0 && <span className="tj-price__discount">{discount}% de desconto</span>}
        <div className="tj-price__row">
          <strong className="tj-price__current">{money(config.pricePerUnitCents)}</strong>
          {comparePrice && comparePrice > config.pricePerUnitCents && (
            <s className="tj-price__compare">{money(comparePrice)}</s>
          )}
        </div>
        {!measured && <span className="tj-price__installments">ou 12x de {money(Math.round(config.pricePerUnitCents / 12))}</span>}
      </div>
      <p className="tj-measurement-price-label">{priceLabel}</p>

      {measured ? (
        <div className="tj-product-form">
          <div className="tj-measurement-calculator">
            <div className="tj-measurement-calculator__heading">
              <div>
                <span className="tj-measurement-calculator__eyebrow">{saleLabel}</span>
                <h2>Quantos metros você precisa?</h2>
              </div>
              <span className="tj-measurement-calculator__badge">calculadora</span>
            </div>

            <div className="tj-measurement-calculator__fields">
              {config.customerChoosesHeight ? (
                <div>
                  <label htmlFor="product-height">Altura desejada</label>
                  <div className="tj-measurement-input">
                    <input
                      id="product-height"
                      type="number"
                      inputMode="decimal"
                      min={config.minHeightM}
                      max={config.maxHeightM}
                      step={config.heightStepM}
                      value={heightM}
                      onChange={(event) => setHeightM(Number(event.target.value))}
                    />
                    <span>m</span>
                  </div>
                </div>
              ) : (
                <div className="tj-measurement-calculator__fixed">
                  <span>Altura definida</span>
                  <strong>{numberPt(config.fixedHeightM || 1)} m</strong>
                </div>
              )}

              <div>
                <label htmlFor="product-length">Comprimento desejado</label>
                <div className="tj-measurement-input">
                  <input
                    id="product-length"
                    type="number"
                    inputMode="decimal"
                    min={config.minLengthM}
                    max={config.maxLengthM}
                    step="0.01"
                    value={lengthM}
                    onChange={(event) => setLengthM(Number(event.target.value))}
                  />
                  <span>m</span>
                </div>
                <small>
                  Digite de {numberPt(config.minLengthM || 1)} a {numberPt(config.maxLengthM || 100)} metros. O corte é feito de {numberPt(config.lengthStepM || .1)} em {numberPt(config.lengthStepM || .1)} metro.
                </small>
              </div>
            </div>

            {calculation && (
              <div className="tj-measurement-calculator__summary">
                <div><span>Você pediu</span><strong>{numberPt(lengthM)} m</strong></div>
                <div>
                  <span>Será cobrado</span>
                  <strong>{config.mode === "square_meter" ? `${numberPt(calculation.billedAreaM2 || 0)} m²` : `${numberPt(calculation.billedLengthM || 0)} m`}</strong>
                </div>
                <div className="tj-measurement-calculator__total"><span>Total</span><strong>{money(calculation.subtotalCents)}</strong></div>
              </div>
            )}
          </div>

          <button
            className="tj-button tj-button--accent tj-button--full"
            type="button"
            disabled={!calculation}
            onClick={() => addItem(product.id, quantity, { lengthM, heightM })}
          >
            <span>Adicionar medida ao carrinho</span><ShoppingCart aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="tj-product-form">
          <div className="tj-product-form__row">
            <div className="tj-quantity">
              <button type="button" onClick={() => updateQuantity(quantity - 1)} aria-label="Diminuir quantidade"><Minus aria-hidden="true" /></button>
              <label className="tj-visually-hidden" htmlFor="product-quantity">Quantidade</label>
              <input id="product-quantity" type="number" min="1" max="999" value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} />
              <button type="button" onClick={() => updateQuantity(quantity + 1)} aria-label="Aumentar quantidade"><Plus aria-hidden="true" /></button>
            </div>
            <button className="tj-button tj-button--accent tj-button--full" type="button" onClick={() => addItem(product.id, quantity)}>
              <span>Comprar</span><ShoppingCart aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="tj-product-stock">
        <Check aria-hidden="true" />
        {product.inventory === 0 ? "Produto indisponível" : product.inventory ? `${product.inventory} em estoque` : "Produto disponível"}
      </div>
      <div className="tj-product-shipping-note">
        <strong>Entregas para todo o Brasil</strong>
        <p>O prazo e o valor do frete são calculados no carrinho de acordo com o CEP.</p>
        <a href="/carrinho">Calcular frete no carrinho</a>
      </div>
    </div>
  );
}

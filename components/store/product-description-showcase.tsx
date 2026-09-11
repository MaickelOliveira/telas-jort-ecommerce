import Image from "next/image";
import { Box, PackageCheck, Ruler, ShieldCheck } from "lucide-react";
import { numberPt } from "@/lib/format";
import type { StoreProduct } from "@/lib/types";

function saleModeLabel(product: StoreProduct) {
  switch (product.measurement.mode) {
    case "linear_meter": return "Metro corrido";
    case "square_meter": return "Metro quadrado";
    case "fixed_roll": return "Rolo fechado";
    default: return "Por unidade";
  }
}

function measurementLabel(product: StoreProduct) {
  const config = product.measurement;
  if (config.fixedHeightM) return `Altura: ${numberPt(config.fixedHeightM)} m`;
  if (config.customerChoosesHeight && config.minHeightM && config.maxHeightM) {
    return `Altura: ${numberPt(config.minHeightM)} a ${numberPt(config.maxHeightM)} m`;
  }
  if (config.minLengthM && config.maxLengthM) {
    return `Comprimento: ${numberPt(config.minLengthM)} a ${numberPt(config.maxLengthM)} m`;
  }
  return product.subcategory || product.category;
}

function weightLabel(product: StoreProduct) {
  const config = product.measurement;
  if (config.kgPerLinearM) return `${numberPt(config.kgPerLinearM)} kg por metro`;
  if (config.kgPerSquareM) return `${numberPt(config.kgPerSquareM)} kg por m²`;
  if (config.kgPerUnit) return `${numberPt(config.kgPerUnit)} kg por unidade`;
  return `${numberPt(product.weightKg)} kg estimados`;
}

export function ProductDescriptionShowcase({ product }: { product: StoreProduct }) {
  const saleMode = saleModeLabel(product);
  const measurement = measurementLabel(product);
  const weight = weightLabel(product);

  return (
    <section className="tj-product-description">
      <div className="tj-page-width">
        <header className="tj-product-description__title">
          <div>
            <span>Informação que ajuda a escolher</span>
            <h2>Conheça o produto em detalhes</h2>
          </div>
          <p>{product.metaDescription}</p>
        </header>

        <div className="tj-product-description__showcase">
          <figure className={`tj-technical-visual tj-technical-visual--${product.category.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`}>
            <div className="tj-technical-visual__canvas">
              <span className="tj-technical-visual__axis tj-technical-visual__axis--horizontal" aria-hidden="true" />
              <span className="tj-technical-visual__axis tj-technical-visual__axis--vertical" aria-hidden="true" />
              <Image
                className="tj-technical-visual__product"
                src={product.image}
                alt={`Vista técnica de ${product.name}`}
                width={760}
                height={760}
                sizes="(max-width: 749px) 82vw, 390px"
              />
              <span className="tj-technical-callout tj-technical-callout--top">{product.subcategory || product.category}</span>
              <span className="tj-technical-callout tj-technical-callout--left">{saleMode}</span>
              <span className="tj-technical-callout tj-technical-callout--right">{measurement}</span>
            </div>
            <figcaption>
              <span>VISUAL TÉCNICO</span>
              <strong>{product.name}</strong>
              <small>Imagem ilustrativa do formato e apresentação do produto.</small>
            </figcaption>
          </figure>

          <article className="tj-product-description__copy">
            <div className="tj-product-spec-grid" aria-label="Resumo técnico">
              <div><Ruler aria-hidden="true" /><span>Forma de venda</span><strong>{saleMode}</strong></div>
              <div><PackageCheck aria-hidden="true" /><span>Medida principal</span><strong>{measurement}</strong></div>
              <div><Box aria-hidden="true" /><span>Peso de referência</span><strong>{weight}</strong></div>
              <div><ShieldCheck aria-hidden="true" /><span>Aplicação</span><strong>{product.category} · {product.subcategory || "Uso geral"}</strong></div>
            </div>

            <div
              className="tj-rte tj-product-description__content"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml || "<p>Consulte nossa equipe para mais informações sobre este produto.</p>" }}
            />
          </article>
        </div>
      </div>
    </section>
  );
}

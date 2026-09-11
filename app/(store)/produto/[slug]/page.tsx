import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductDescriptionShowcase } from "@/components/store/product-description-showcase";
import { ProductPurchase } from "@/components/store/product-purchase";
import { ProductRail } from "@/components/store/product-rail";
import { getRuntimeProduct, getRuntimeProducts } from "@/lib/catalog-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getRuntimeProduct(slug);
  return product ? { title: product.name, description: product.metaDescription } : { title: "Produto não encontrado" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getRuntimeProduct(slug);
  if (!product) notFound();

  const related = getRuntimeProducts()
    .filter((item) => item.active && item.category === product.category && item.id !== product.id)
    .slice(0, 8);
  const origin = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.images.map((image) => `${origin}${image}`),
    description: product.metaDescription,
    brand: { "@type": "Brand", name: "Telas Jort" },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (product.measurement.pricePerUnitCents / 100).toFixed(2),
      availability: product.inventory === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${origin}/produto/${product.slug}`,
    },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="tj-page-width">
        <nav className="tj-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link><span>›</span>
          <Link href={`/produtos?categoria=${encodeURIComponent(product.category)}`}>{product.category}</Link><span>›</span>
          <span>{product.name}</span>
        </nav>
        <div className="tj-product-banner" aria-label={`Resumo de ${product.name}`}>
          <strong>{product.name}</strong>
          <span aria-hidden="true" />
          <p>{product.metaDescription || `Qualidade e praticidade para seu projeto com ${product.name.toLocaleLowerCase("pt-BR")}.`}</p>
        </div>
        <div className="tj-product-layout">
          <ProductGallery images={product.images} name={product.name} />
          <ProductPurchase product={product} />
        </div>
      </section>

      <ProductDescriptionShowcase product={product} />

      {related.length > 0 && (
        <section className="tj-section">
          <div className="tj-page-width">
            <div className="tj-section__heading"><h2>Você também pode gostar</h2></div>
            <ProductRail products={related} />
          </div>
        </section>
      )}
    </main>
  );
}

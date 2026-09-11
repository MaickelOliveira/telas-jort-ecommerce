import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { CollectionSort } from "@/components/store/collection-sort";
import { ProductCard } from "@/components/store/product-card";
import { categories } from "@/lib/catalog";
import { getRuntimeProductsByCategory } from "@/lib/catalog-server";

export const metadata: Metadata = { title: "Produtos" };

type SearchParams = {
  categoria?: string;
  q?: string;
  ordem?: string;
};

const categoryCopy: Record<string, { eyebrow: string; text: string }> = {
  Todos: {
    eyebrow: "Catálogo completo",
    text: "Telas, arames, acessórios, ferramentas e proteção para fazer o projeto completo.",
  },
  Telas: {
    eyebrow: "Proteção sob medida",
    text: "Escolha a tela certa para cercas, viveiros, jardins, obras e propriedades rurais.",
  },
  Arames: {
    eyebrow: "Força em cada metro",
    text: "Arames lisos, farpados e galvanizados para cercamentos firmes e duráveis.",
  },
  Acessórios: {
    eyebrow: "Instalação bem resolvida",
    text: "Fixadores, catracas, grampos e componentes que deixam cada montagem mais segura.",
  },
  Ferramentas: {
    eyebrow: "Trabalho preciso",
    text: "Ferramentas práticas para cortar, medir, tensionar e finalizar sua instalação.",
  },
  EPIs: {
    eyebrow: "Proteção no trabalho",
    text: "Equipamentos essenciais para instalar e fazer manutenção com mais segurança.",
  },
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { categoria = "Todos", q = "", ordem = "relevantes" } = await searchParams;
  const current = categories.includes(categoria) ? categoria : "Todos";
  const normalized = q.trim().toLocaleLowerCase("pt-BR");
  const sort = ["relevantes", "menor-preco", "maior-preco", "a-z"].includes(ordem)
    ? ordem
    : "relevantes";
  const list = getRuntimeProductsByCategory(current)
    .filter((product) => !normalized || `${product.name} ${product.sku} ${product.category} ${product.subcategory}`.toLocaleLowerCase("pt-BR").includes(normalized));

  if (sort === "menor-preco") list.sort((a, b) => a.measurement.pricePerUnitCents - b.measurement.pricePerUnitCents);
  if (sort === "maior-preco") list.sort((a, b) => b.measurement.pricePerUnitCents - a.measurement.pricePerUnitCents);
  if (sort === "a-z") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const title = normalized
    ? `Busca por “${q.trim()}”`
    : current === "Todos"
      ? "Todos os produtos"
      : current;
  const bannerCopy = categoryCopy[current] || categoryCopy.Todos;
  const bannerProducts = list.slice(0, 3);

  return (
    <main className="tj-page-width">
      <nav className="tj-breadcrumb" aria-label="Navegação estrutural">
        <Link href="/">Início</Link><span>›</span><span>{title}</span>
      </nav>

      <header className="tj-collection-banner">
        <div className="tj-collection-banner__content">
          <span>{normalized ? "Resultado da sua busca" : bannerCopy.eyebrow}</span>
          <h1>{title}</h1>
          <p>{normalized ? "Confira os produtos encontrados e escolha a melhor opção para o seu projeto." : bannerCopy.text}</p>
        </div>
        {bannerProducts.length > 0 && (
          <div className="tj-collection-banner__products" aria-label="Produtos em destaque nesta página">
            {bannerProducts.map((product, index) => (
              <span className={`tj-collection-banner__product tj-collection-banner__product--${index + 1}`} key={product.id}>
                <Image src={product.image} alt={product.name} fill sizes="(max-width: 749px) 110px, 180px" />
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="tj-collection-layout">
        <aside className="tj-collection-sidebar tj-collection-sidebar--desktop" aria-label="Filtros">
          <details className="tj-filter-group" open>
            <summary>Categorias <span>+</span></summary>
            <div className="tj-filter-group__values">
              {categories.map((category) => (
                <Link
                  key={category}
                  href={category === "Todos" ? "/produtos" : `/produtos?categoria=${encodeURIComponent(category)}`}
                  aria-current={category === current && !normalized ? "page" : undefined}
                >
                  {category === "Todos" ? "Todos os produtos" : category}
                </Link>
              ))}
            </div>
          </details>
          <details className="tj-filter-group" open>
            <summary>Disponibilidade <span>+</span></summary>
            <div className="tj-filter-group__values">
              <label className="tj-filter-check">
                <input type="checkbox" defaultChecked disabled />
                <span>Em estoque ({list.length})</span>
              </label>
            </div>
          </details>
        </aside>

        <section className="tj-collection-products">
          <details className="tj-mobile-filter-panel">
            <summary>
              <span><SlidersHorizontal aria-hidden="true" /> Filtros</span>
              <span className="tj-mobile-filter-panel__current">{current === "Todos" ? "Todas as categorias" : current}<ChevronDown aria-hidden="true" /></span>
            </summary>
            <div className="tj-mobile-filter-panel__body">
              <div>
                <strong>Categorias</strong>
                <div className="tj-mobile-filter-panel__categories">
                  {categories.map((category) => (
                    <Link
                      key={category}
                      href={category === "Todos" ? "/produtos" : `/produtos?categoria=${encodeURIComponent(category)}`}
                      aria-current={category === current && !normalized ? "page" : undefined}
                    >
                      {category === "Todos" ? "Todos" : category}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="tj-mobile-filter-panel__stock"><span /> Em estoque: {list.length} produto{list.length === 1 ? "" : "s"}</div>
            </div>
          </details>
          <div className="tj-collection-toolbar">
            <span>{list.length} produto{list.length === 1 ? "" : "s"}</span>
            <CollectionSort value={sort} />
          </div>

          {list.length ? (
            <div className="tj-product-grid">
              {list.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="tj-empty-state">
              <h2>Nenhum produto encontrado</h2>
              <p>Tente buscar por telas, arames, ferramentas ou acessórios.</p>
              <Link className="tj-button tj-button--accent" href="/produtos">Ver todos</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { MapPin, MessageCircle, Truck } from "lucide-react";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { ProductRail } from "@/components/store/product-rail";
import { getRuntimeProducts } from "@/lib/catalog-server";

const categories = [
  { name: "Telas", description: "Soldadas e revestidas", image: "/assets/images/storefront/category-telas.webp" },
  { name: "Arames", description: "Lisos e farpados", image: "/assets/images/storefront/category-arames.webp" },
  { name: "Acessórios", description: "Fixação e montagem", image: "/assets/images/storefront/category-acessorios.webp" },
  { name: "Ferramentas", description: "Instalação e manutenção", image: "/assets/images/storefront/category-ferramentas.webp" },
  { name: "EPIs", description: "Proteção para o trabalho", image: "/assets/images/storefront/category-epis.webp" },
];

const offerHandles = [
  "prego-pct-de-1-kg",
  "abracadeira-em-nylon",
  "clips-para-sombrite",
  "chave-de-emendar-arame",
  "catraca-para-arame-liso",
];

const featuredHandles = [
  "tela-soldada-5x10-1-5mt",
  "tellacor-5x10-1-mt",
  "arame-farpado-500-metros",
  "arame-liso-1000-metros",
  "tela-soldada-5x10-1-mt",
];

type BannerProps = {
  image: string;
  title: string;
  text: string;
  href: string;
  button: string;
};

function Banner({ image, title, text, href, button }: BannerProps) {
  return (
    <article className="tj-image-banner">
      <Image className="tj-image-banner__image" src={image} alt={title} fill sizes="(max-width: 749px) 88vw, 50vw" />
      <div className="tj-image-banner__content">
        <h3>{title}</h3>
        <p>{text}</p>
        <Link className="tj-button tj-button--light" href={href}>{button}</Link>
      </div>
    </article>
  );
}

function BenefitCard({ image, icon: Icon, eyebrow, title, text, href, action }: {
  image: string;
  icon: typeof MapPin;
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <Link className="tj-benefit-card" href={href}>
      <span className="tj-benefit-card__media">
        <Image
          src={image}
          alt=""
          width={1280}
          height={640}
          sizes="(max-width: 749px) 100vw, 420px"
        />
      </span>
      <span className="tj-benefit-card__content">
        <span className="tj-benefit-card__icon"><Icon aria-hidden="true" /></span>
        <small>{eyebrow}</small>
        <strong>{title}</strong>
        <span>{text}</span>
        <b>{action} →</b>
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const products = (await getRuntimeProducts()).filter((product) => product.active);
  const pickProducts = (handles: string[]) => handles.flatMap((handle) => {
    const product = products.find((item) => item.slug === handle);
    return product ? [product] : [];
  });
  const offers = pickProducts(offerHandles);
  const featured = pickProducts(featuredHandles);

  return (
    <main className="tj-site-main">
      <HeroCarousel />

      <section className="tj-section tj-section--tight">
        <div className="tj-page-width tj-category-strip">
          <div className="tj-category-strip__intro">
            <span>Compre por categoria</span>
            <strong>Tudo para sua instalação</strong>
            <small>Do material à proteção, encontre tudo em um só lugar.</small>
          </div>
          <div className="tj-category-strip__items">
            {categories.map((category) => (
              <Link
                className="tj-category-bubble"
                href={`/produtos?categoria=${encodeURIComponent(category.name)}`}
                key={category.name}
              >
                <span className="tj-category-bubble__image">
                  <Image src={category.image} alt={category.name} width={78} height={78} />
                </span>
                <span className="tj-category-bubble__copy">
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </span>
                <span className="tj-category-bubble__arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width">
          <div className="tj-section__heading"><h2>Soluções para cada tipo de instalação</h2></div>
          <div className="tj-image-banner-grid">
            <Banner
              image="/assets/images/storefront/solution-arame-farpado-v2.webp"
              title="Arame Farpado"
              text="Resistência e proteção para cercas rurais."
              href="/produtos?categoria=Arames"
              button="Ver arame farpado"
            />
            <Banner
              image="/assets/images/storefront/solution-tela-soldada-v2.webp"
              title="Tela Soldada"
              text="Proteção e cercamento para diferentes aplicações."
              href="/produtos?categoria=Telas"
              button="Ver tela soldada"
            />
          </div>
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width">
          <div className="tj-section__heading">
            <h2>Ofertas da semana</h2>
            <Link href="/produtos">Ver todos</Link>
          </div>
          <ProductRail products={offers} />
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width">
          <div className="tj-section__heading"><h2>Soluções para o seu projeto</h2></div>
          <div className="tj-image-banner-grid tj-image-banner-grid--carousel">
            <Banner
              image="/assets/images/storefront/project-telas-v2.webp"
              title="Proteção para aviários e criações"
              text="Telas e cercamentos para áreas protegidas e organizadas."
              href="/produtos?categoria=Telas"
              button="Ver telas"
            />
            <Banner
              image="/assets/images/storefront/project-arames-v3.webp"
              title="Cercas para propriedades rurais"
              text="Arames, catracas e acessórios para cercas firmes e duráveis."
              href="/produtos?categoria=Arames"
              button="Ver soluções"
            />
            <Banner
              image="/assets/images/storefront/project-tellacor.webp"
              title="Hortas e áreas protegidas"
              text="Tellacor e soluções práticas para cercamentos leves."
              href="/produtos?categoria=Telas"
              button="Ver Tellacor"
            />
          </div>
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width">
          <div className="tj-section__heading">
            <h2>Produtos em destaque</h2>
            <Link href="/produtos">Ver todos</Link>
          </div>
          <ProductRail products={featured} />
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width">
          <div className="tj-section__heading"><h2>Compre com mais facilidade</h2></div>
          <div className="tj-benefit-images">
            <BenefitCard image="/assets/images/storefront/benefit-retire-na-loja-v2.webp" icon={MapPin} eyebrow="Retirada local" title="Compre online e retire na loja" text="Seu pedido separado para retirada em Campo Mourão." href="/carrinho" action="Comprar agora" />
            <BenefitCard image="/assets/images/storefront/benefit-atendimento-whatsapp-v3.webp" icon={MessageCircle} eyebrow="Atendimento especializado" title="Ajuda para escolher o produto certo" text="Fale com quem entende de telas, arames e instalação." href="/contato" action="Falar com a equipe" />
            <BenefitCard image="/assets/images/storefront/benefit-envio-brasil-v3.webp" icon={Truck} eyebrow="Entrega segura" title="Enviamos para todo o Brasil" text="Produtos protegidos e preparados para cada destino." href="/produtos" action="Ver produtos" />
          </div>
        </div>
      </section>

      <section className="tj-section">
        <div className="tj-page-width tj-testimonials">
          <h2 className="tj-testimonials__title">O que falam sobre a Telas Jort</h2>
          <div className="tj-testimonials__rail">
            <blockquote className="tj-testimonial-card">
              <strong>Edvanir G.</strong>
              <span>“Sou cliente há alguns anos e sempre que preciso só compro na Telas Jort. Tenho uma fazenda e praticamente tudo que construímos aqui veio de lá.”</span>
            </blockquote>
            <blockquote className="tj-testimonial-card">
              <strong>Fernanda Lima</strong>
              <span>“Produtos de excelente qualidade, comprei e recomendo demais. Chegou no prazo, com segurança e sem avaria alguma.”</span>
            </blockquote>
          </div>
        </div>
      </section>
    </main>
  );
}

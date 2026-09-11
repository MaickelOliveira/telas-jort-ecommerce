"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const slides = [
  {
    src: "/assets/images/storefront/hero-telas-variedade-v2.webp",
    eyebrow: "Alambrado, soldadas, hexagonais e mais",
    title: "Telas para",
    highlight: "cada projeto",
    description:
      "Proteção e cercamento com a tela certa para cada tipo de instalação.",
    alt: "Alambrado, tela hexagonal, tela soldada, tela revestida e sombrite",
  },
  {
    src: "/assets/images/storefront/hero-instalacao-cerca-v4.webp",
    eyebrow: "Instalação firme, do início ao acabamento",
    title: "Tudo para",
    highlight: "montar sua cerca",
    description:
      "Veja na prática como arames, grampos e ferramentas formam uma cerca resistente e bem tensionada.",
    alt: "Profissional instalando e tensionando arames finos em cerca rural",
  },
  {
    src: "/assets/images/storefront/hero-arames-acessorios-epis-v3.webp",
    eyebrow: "Proteção do começo ao fim",
    title: "Arames, acessórios",
    highlight: "e EPIs",
    description:
      "Materiais, ferramentas e equipamentos de proteção para trabalhar com segurança.",
    alt: "Arames, acessórios para cercas, luvas e óculos de proteção",
  },
  {
    src: "/assets/images/storefront/hero-gradil-completo-v3.webp",
    eyebrow: "Sistema completo de cercamento",
    title: "Gradil completo:",
    highlight: "segurança com acabamento",
    description:
      "Painéis, postes, bases e fixadores nas cores verde, preto, azul e branco.",
    alt: "Sistema de gradil com painéis verde, preto, azul e branco, postes e acessórios de fixação",
  },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((index) => (index + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  const show = (index: number) => {
    setCurrent((index + slides.length) % slides.length);
  };

  return (
    <section className="tj-hero" aria-label="Destaques Telas Jort">
      <div
        className="tj-hero__track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div
            className="tj-hero__slide"
            key={slide.src}
            aria-hidden={current !== index}
          >
            <Image
              className="tj-hero__image"
              src={slide.src}
              alt={slide.alt}
              width={1580}
              height={700}
              priority={index === 0}
              sizes="100vw"
            />
            <div className="tj-hero__content">
              <span className="tj-hero__eyebrow">{slide.eyebrow}</span>
              <h2>
                {slide.title}
                <strong>{slide.highlight}</strong>
              </h2>
              <p>{slide.description}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        className="tj-round-arrow tj-hero__arrow--prev"
        type="button"
        onClick={() => show(current - 1)}
        aria-label="Banner anterior"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        className="tj-round-arrow tj-hero__arrow--next"
        type="button"
        onClick={() => show(current + 1)}
        aria-label="Próximo banner"
      >
        <ChevronRight aria-hidden="true" />
      </button>

      <div className="tj-hero__dots">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            className={`tj-hero__dot${current === index ? " is-active" : ""}`}
            onClick={() => show(index)}
            aria-label={`Ver banner ${index + 1}`}
            aria-current={current === index ? "true" : undefined}
          />
        ))}
      </div>
    </section>
  );
}

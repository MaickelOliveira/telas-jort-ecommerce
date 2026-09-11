import Image from "next/image";

const fallbackImages = [
  "/assets/images/products/tela-soldada-5x10-1-mt/01.webp",
  "/assets/images/products/arame-farpado-500-metros/01.webp",
  "/assets/images/products/luva-de-raspa-15cm/01.webp",
];

export function CompactPageBanner({
  eyebrow = "Telas Jort",
  title,
  text,
  images = fallbackImages,
  headingLevel = "h1",
}: {
  eyebrow?: string;
  title: string;
  text: string;
  images?: string[];
  headingLevel?: "h1" | "h2";
}) {
  const visibleImages = Array.from(new Set([...images, ...fallbackImages].filter(Boolean))).slice(0, 3);
  const Heading = headingLevel;

  return (
    <header className="tj-page-banner">
      <div className="tj-page-banner__content">
        <span>{eyebrow}</span>
        <Heading>{title}</Heading>
        <p>{text}</p>
      </div>
      <div className="tj-page-banner__products" aria-hidden="true">
        {visibleImages.map((image, index) => (
          <span className={`tj-page-banner__product tj-page-banner__product--${index + 1}`} key={`${image}-${index}`}>
            <Image src={image} alt="" fill sizes="(max-width: 749px) 90px, 140px" />
          </span>
        ))}
      </div>
    </header>
  );
}

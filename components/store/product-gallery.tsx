"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const safeImages = images.length ? images : ["/assets/images/storefront/category-telas.webp"];
  const [active, setActive] = useState(safeImages[0]);

  return (
    <div className="tj-product-gallery">
      <div className="tj-product-gallery__thumbs" aria-label="Fotos do produto">
        {safeImages.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setActive(image)}
            className={`tj-product-gallery__thumb${active === image ? " is-active" : ""}`}
            aria-label={`Ver foto ${index + 1}`}
          >
            <Image src={image} alt={`${name} — foto ${index + 1}`} fill sizes="82px" />
          </button>
        ))}
      </div>
      <div className="tj-product-gallery__main">
        <Image src={active} alt={name} fill priority sizes="(max-width: 989px) 100vw, 55vw" />
      </div>
    </div>
  );
}

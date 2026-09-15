"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ProductImage } from "@/types/catalogue";
import styles from "./ProductGallery.module.css";

type ProductGalleryProps = {
  images: ProductImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const slides = images.length > 0 ? images : [undefined];
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const current = slides[index] ?? slides[0];
  const total = slides.length;
  const pager = `${String(Math.min(index, total - 1) + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  function scrollTo(next: number) {
    setIndex(next);
    const track = trackRef.current;
    if (!track) {
      return;
    }
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) {
      return;
    }
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== index && next >= 0 && next < total) {
      setIndex(next);
    }
  }

  return (
    <div className={styles.gallery} data-product-gallery>
      <div className={styles.viewport}>
        <div
          ref={trackRef}
          className={styles.track}
          onScroll={handleScroll}
        >
          {slides.map((image, slideIndex) => {
            const clickable = Boolean(image?.src);
            const media = image?.src ? (
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                className={styles.image}
                sizes="(min-width: 1200px) 50vw, 100vw"
                priority={slideIndex === 0}
              />
            ) : (
              <span className={styles.fallback} aria-hidden="true" />
            );

            if (!clickable) {
              return (
                <div
                  key={image?.id ?? "empty"}
                  className={styles.slide}
                  role="img"
                  aria-label={`${productName} photography`}
                >
                  {media}
                </div>
              );
            }

            return (
              <button
                key={image?.id ?? "empty"}
                type="button"
                className={styles.slide}
                data-has-src="true"
                onClick={() => {
                  setIndex(slideIndex);
                  setLightbox(true);
                }}
                aria-label={`Enlarge ${productName} image`}
              >
                {media}
              </button>
            );
          })}
        </div>
      </div>
      {total > 1 ? (
        <p className={`text-micro ${styles.pager}`}>{pager}</p>
      ) : null}
      {total > 1 ? (
        <ul className={styles.thumbs}>
          {slides.map((image, thumbIndex) => (
            <li key={image?.id ?? `thumb-${thumbIndex}`}>
              <button
                type="button"
                className={styles.thumb}
                aria-current={thumbIndex === index}
                aria-label={`View image ${thumbIndex + 1}`}
                onClick={() => scrollTo(thumbIndex)}
              >
                {image?.src ? (
                  <Image
                    src={image.src}
                    alt=""
                    width={image.width}
                    height={image.height}
                    className={styles.thumbImage}
                  />
                ) : (
                  <span className={`${styles.thumbFallback} text-micro`}>
                    {String(thumbIndex + 1).padStart(2, "0")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Modal
        open={Boolean(lightbox && current?.src)}
        onClose={() => setLightbox(false)}
        titleId={titleId}
        className={styles.lightbox}
      >
        <h2 id={titleId} className="visually-hidden">
          {productName}
        </h2>
        {current?.src ? (
          <Image
            src={current.src}
            alt={current.alt}
            width={current.width}
            height={current.height}
            className={styles.lightboxImage}
          />
        ) : null}
        <Button variant="tertiary" onClick={() => setLightbox(false)}>
          Close
        </Button>
      </Modal>
    </div>
  );
}

import Image from "next/image";
import { cx } from "@/lib/cx";
import type { PublicCartImage } from "@/types/cart";
import styles from "./ProductThumb.module.css";

type ProductThumbProps = {
  image?: PublicCartImage;
  sizes?: string;
  compact?: boolean;
};

export function ProductThumb({
  image,
  sizes = "(min-width: 768px) 8rem, 6.5rem",
  compact = false,
}: ProductThumbProps) {
  return (
    <span className={cx(styles.media, compact && styles.compact)}>
      {image?.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          className={styles.image}
          sizes={sizes}
        />
      ) : (
        <span className={styles.fallback} aria-hidden="true" />
      )}
    </span>
  );
}

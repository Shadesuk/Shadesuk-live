import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { formatGbp } from "@/lib/money";
import {
  getImageFallbackLabel,
  getPrimaryImage,
  getProductBrandName,
  getProductHref,
} from "@/lib/product-display";
import type { Product } from "@/types/catalogue";
import { MediaPlaceholder } from "./MediaPlaceholder";
import styles from "./ProductStory.module.css";

type ProductStoryProps = {
  product: Product;
};

export function ProductStory({ product }: ProductStoryProps) {
  const href = getProductHref(product);
  const brand = getProductBrandName(product);
  const primary = getPrimaryImage(product);
  const fallback = getImageFallbackLabel(primary?.role ?? "front");

  return (
    <Section labelledBy="product-story-heading">
      <ContentWidth className={styles.story}>
        <Link href={href} className={styles.media} aria-label={product.name}>
          {primary?.src ? (
            <Image
              src={primary.src}
              alt={primary.alt || product.name}
              width={primary.width}
              height={primary.height}
              className={styles.image}
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          ) : (
            <MediaPlaceholder label={fallback} ratio="story" />
          )}
        </Link>
        <div className={styles.copy}>
          <p className="text-micro">Flagship product</p>
          {brand ? <p className="text-micro">{brand}</p> : null}
          <h2 id="product-story-heading" className="text-h2">
            <Link href={href}>{product.name}</Link>
          </h2>
          <p className="text-small">{formatGbp(product.price)}</p>
          <ButtonLink href={href}>View product</ButtonLink>
        </div>
      </ContentWidth>
    </Section>
  );
}

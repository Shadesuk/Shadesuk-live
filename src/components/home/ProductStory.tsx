import { ButtonLink } from "@/components/ui/ButtonLink";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { formatGbp } from "@/lib/money";
import {
  getBrandName,
  getColourCount,
  getProductHref,
} from "@/services/catalogue";
import type { Product } from "@/types/catalogue";
import { MediaPlaceholder } from "./MediaPlaceholder";
import styles from "./ProductStory.module.css";

type ProductStoryProps = {
  product: Product;
};

export function ProductStory({ product }: ProductStoryProps) {
  const href = getProductHref(product);
  const brand = getBrandName(product);
  const colourCount = getColourCount(product);
  const colourLabel = `${colourCount} ${colourCount === 1 ? "colour" : "colours"}`;

  return (
    <Section labelledBy="product-story-heading">
      <ContentWidth className={styles.story}>
        <MediaPlaceholder label="Product image" ratio="story" />
        <div className={styles.copy}>
          <p className="text-micro">{brand}</p>
          <h2 id="product-story-heading" className="text-h2">
            {product.name}
          </h2>
          {product.description ? (
            <p className="text-body">{product.description}</p>
          ) : null}
          <p className="text-small">{formatGbp(product.price)}</p>
          <p className="text-micro">{colourLabel}</p>
          <ButtonLink href={href}>Shop this style</ButtonLink>
        </div>
      </ContentWidth>
    </Section>
  );
}

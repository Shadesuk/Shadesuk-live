import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { cx } from "@/lib/cx";
import { genderLinks, routes } from "@/lib/navigation";
import { CampaignImage } from "./CampaignImage";
import styles from "./GenderDiscovery.module.css";

const genderImages = {
  [routes.men]: {
    src: "/campaign/shop-men.png",
    alt: "Black rectangular sunglasses worn with a black knit sweater.",
    width: 1024,
    height: 1536,
    crop: styles.men,
  },
  [routes.women]: {
    src: "/campaign/shop-women.png",
    alt: "Tortoiseshell sunglasses in close-up.",
    width: 1774,
    height: 887,
    crop: styles.women,
  },
  [routes.unisex]: {
    src: "/campaign/shop-unisex.jpg",
    alt: "Tortoiseshell sunglasses resting on stone, casting a long shadow.",
    width: 624,
    height: 531,
    crop: styles.unisex,
  },
} as const;

export function GenderDiscovery() {
  return (
    <Section labelledBy="gender-heading">
      <ContentWidth className={styles.section}>
        <h2 id="gender-heading" className="text-h2">
          Shop by gender
        </h2>
        <ul className={styles.list}>
          {genderLinks.map((item) => {
            const image = genderImages[item.href];
            return (
              <li key={item.href}>
                <Link className={styles.card} href={item.href}>
                  <div className={styles.media}>
                    <CampaignImage
                      src={image.src}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      sizes="(min-width: 1200px) 26rem, (min-width: 768px) 30vw, calc(100vw - 2rem)"
                      className={cx(styles.image, image.crop)}
                    />
                  </div>
                  <span className="text-h3">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </ContentWidth>
    </Section>
  );
}

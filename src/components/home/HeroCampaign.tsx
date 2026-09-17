import Image from "next/image";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FullBleed } from "@/components/layout/FullBleed";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { routes } from "@/lib/navigation";
import styles from "./HeroCampaign.module.css";

const HERO_IMAGE = {
  src: "/campaign/homepage-hero.png",
  alt: "A man and a woman wearing sunglasses, photographed against a blue sky.",
  width: 1844,
  height: 853,
} as const;

export function HeroCampaign() {
  return (
    <header className={styles.hero}>
      <FullBleed className={styles.stage}>
        <div className={styles.media}>
          <Image
            src={HERO_IMAGE.src}
            alt={HERO_IMAGE.alt}
            width={HERO_IMAGE.width}
            height={HERO_IMAGE.height}
            sizes="(max-width: 767px) 220vw, 100vw"
            priority
            className={styles.image}
          />
        </div>
        <ContentWidth className={styles.copy}>
          <p className={`text-micro ${styles.eyebrow}`}>SHADESUK</p>
          <h1 className="text-display">See the difference.</h1>
          <div className={styles.actions}>
            <ButtonLink href={routes.men}>Shop men</ButtonLink>
            <ButtonLink href={routes.women} variant="secondary">
              Shop women
            </ButtonLink>
          </div>
        </ContentWidth>
      </FullBleed>
    </header>
  );
}

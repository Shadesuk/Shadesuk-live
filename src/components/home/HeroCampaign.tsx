import { ButtonLink } from "@/components/ui/ButtonLink";
import { FullBleed } from "@/components/layout/FullBleed";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { MediaSlot } from "@/components/media/MediaSlot";
import { routes } from "@/lib/navigation";
import type { ProductImage } from "@/types/catalogue";
import styles from "./HeroCampaign.module.css";

type HeroCampaignProps = {
  image?: ProductImage;
};

export function HeroCampaign({ image }: HeroCampaignProps) {
  const filled = Boolean(image?.src);

  return (
    <header className={styles.hero} data-filled={filled || undefined}>
      {filled ? (
        <FullBleed>
          <MediaSlot
            label="Campaign photography"
            ratio="campaign"
            image={image}
            sizes="100vw"
            priority
          />
        </FullBleed>
      ) : null}
      <ContentWidth className={styles.copy}>
        <h1 className="text-display">Shades for every angle.</h1>
        <div className={styles.actions}>
          <ButtonLink href={routes.men}>Shop men</ButtonLink>
          <ButtonLink href={routes.women} variant="secondary">
            Shop women
          </ButtonLink>
        </div>
      </ContentWidth>
      {filled ? null : (
        <FullBleed>
          <MediaSlot
            label="Campaign photography"
            ratio="campaign"
            compactEmpty
            sizes="100vw"
          />
        </FullBleed>
      )}
    </header>
  );
}

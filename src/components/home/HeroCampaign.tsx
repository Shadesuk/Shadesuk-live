import { ButtonLink } from "@/components/ui/ButtonLink";
import { FullBleed } from "@/components/layout/FullBleed";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { routes } from "@/lib/navigation";
import { MediaPlaceholder } from "./MediaPlaceholder";
import styles from "./HeroCampaign.module.css";

export function HeroCampaign() {
  return (
    <header className={styles.hero}>
      <FullBleed>
        <MediaPlaceholder label="Campaign image" ratio="campaign" />
      </FullBleed>
      <ContentWidth className={styles.copy}>
        <h1 className="text-display">Shades for every angle.</h1>
        <div className={styles.actions}>
          <ButtonLink href={routes.men}>Shop men</ButtonLink>
          <ButtonLink href={routes.women} variant="secondary">
            Shop women
          </ButtonLink>
        </div>
      </ContentWidth>
    </header>
  );
}

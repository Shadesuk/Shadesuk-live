import { ContentWidth } from "@/components/layout/ContentWidth";
import { FullBleed } from "@/components/layout/FullBleed";
import { Section } from "@/components/layout/Section";
import { CampaignImage } from "./CampaignImage";
import styles from "./EditorialBrandMoment.module.css";

const EDITORIAL_IMAGE = {
  src: "/campaign/editorial-banner.png",
  alt: "A man in black sunglasses and a cream textured jacket, seated against a sunlit stone wall.",
  width: 1024,
  height: 1536,
} as const;

export function EditorialBrandMoment() {
  return (
    <Section labelledBy="editorial-heading">
      <FullBleed>
        <div className={styles.media}>
          <CampaignImage
            src={EDITORIAL_IMAGE.src}
            alt={EDITORIAL_IMAGE.alt}
            width={EDITORIAL_IMAGE.width}
            height={EDITORIAL_IMAGE.height}
            sizes="100vw"
            className={styles.image}
          />
          <ContentWidth className={styles.copy}>
            <h2 id="editorial-heading">every look tells a story</h2>
          </ContentWidth>
        </div>
      </FullBleed>
    </Section>
  );
}

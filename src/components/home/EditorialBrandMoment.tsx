import { ContentWidth } from "@/components/layout/ContentWidth";
import { FullBleed } from "@/components/layout/FullBleed";
import { Section } from "@/components/layout/Section";
import { MediaPlaceholder } from "./MediaPlaceholder";
import styles from "./EditorialBrandMoment.module.css";

export function EditorialBrandMoment() {
  return (
    <Section labelledBy="editorial-heading">
      <FullBleed>
        <MediaPlaceholder label="Editorial photography" ratio="editorial" />
      </FullBleed>
      <ContentWidth className={styles.copy}>
        <h2 id="editorial-heading" className="text-h1">
          Built around the way you see the world.
        </h2>
      </ContentWidth>
    </Section>
  );
}

import { ButtonLink } from "@/components/ui/ButtonLink";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { routes } from "@/lib/navigation";
import styles from "./FinalCta.module.css";

export function FinalCta() {
  return (
    <Section labelledBy="final-cta-heading">
      <ContentWidth className={styles.block}>
        <h2 id="final-cta-heading" className="text-h1">
          Find your frame.
        </h2>
        <ButtonLink href={routes.shop}>Shop all shades</ButtonLink>
      </ContentWidth>
    </Section>
  );
}

import { ButtonLink } from "@/components/ui/ButtonLink";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { FullBleed } from "@/components/layout/FullBleed";
import { MediaPlaceholder } from "@/components/home/MediaPlaceholder";
import { Section } from "@/components/layout/Section";
import {
  ABOUT_CTA,
  ABOUT_HEADING,
  ABOUT_LEDE,
  ABOUT_POINTS,
} from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { RelatedLinks } from "./RelatedLinks";
import styles from "./InfoPage.module.css";

export function AboutPage() {
  return (
    <div className={styles.page}>
      <FullBleed>
        <MediaPlaceholder label="Editorial image" ratio="editorial" />
      </FullBleed>
      <ContentWidth className={styles.aboutCopy}>
        <h1 className="text-h1">{ABOUT_HEADING}</h1>
        <p className={`text-body ${styles.lede}`}>{ABOUT_LEDE}</p>
        <ButtonLink href={routes.shop}>{ABOUT_CTA}</ButtonLink>
      </ContentWidth>
      <Section compact labelledBy="about-points">
        <ContentWidth>
          <h2 id="about-points" className="visually-hidden">
            About SHADESUK
          </h2>
          <ul className={styles.points}>
            {ABOUT_POINTS.map((point) => (
              <li key={point.id}>
                <h3 className="text-micro">{point.title}</h3>
                <p className="text-small">{point.body}</p>
              </li>
            ))}
          </ul>
        </ContentWidth>
      </Section>
      <ContentWidth>
        <RelatedLinks
          links={[
            { href: routes.contact, label: "Contact" },
            { href: routes.shipping, label: "Shipping" },
            { href: routes.faq, label: "FAQ" },
          ]}
        />
      </ContentWidth>
    </div>
  );
}

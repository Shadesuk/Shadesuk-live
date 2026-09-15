import { ContentWidth } from "@/components/layout/ContentWidth";
import {
  CONTACT_CHANNEL,
  CONTACT_LEDE,
  CONTACT_PATHWAYS,
  CONTACT_TITLE,
} from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { InfoTextLink } from "./InfoTextLink";
import { RelatedLinks } from "./RelatedLinks";
import styles from "./InfoPage.module.css";

export function ContactPage() {
  return (
    <ContentWidth>
      <article className={styles.document}>
        <header className={styles.header}>
          <h1 className="text-h2">{CONTACT_TITLE}</h1>
          <p className={`text-body ${styles.lede}`}>{CONTACT_LEDE}</p>
          <p className="text-small">{CONTACT_CHANNEL}</p>
        </header>
        <ul className={styles.pathways}>
          {CONTACT_PATHWAYS.map((item) => (
            <li key={item.href}>
              <InfoTextLink className={styles.pathway} href={item.href}>
                <h2 className="text-micro">{item.label}</h2>
                <p className="text-small">{item.body}</p>
              </InfoTextLink>
            </li>
          ))}
        </ul>
        <RelatedLinks
          links={[
            { href: routes.terms, label: "Terms" },
            { href: routes.privacy, label: "Privacy" },
          ]}
        />
      </article>
    </ContentWidth>
  );
}

import type { PolicyDocument } from "@/lib/legal-copy";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { InfoTextLink } from "./InfoTextLink";
import { RelatedLinks } from "./RelatedLinks";
import styles from "./InfoPage.module.css";

export function PolicyDocumentView({ document }: { document: PolicyDocument }) {
  return (
    <ContentWidth>
      <article className={styles.document}>
        <header className={styles.header}>
          <h1 className="text-h2">{document.title}</h1>
          <p className={`text-body ${styles.lede}`}>{document.lede}</p>
          <p className={`text-small ${styles.notice}`}>{document.notice}</p>
        </header>
        {document.sections.map((section) => (
          <section key={section.id} className={styles.section} aria-labelledby={section.id}>
            <h2 id={section.id} className="text-h3">
              {section.title}
            </h2>
            <div className={styles.prose}>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.id}-${index}`} className="text-body">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="text-small">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.link ? (
                <p className="text-small">
                  <InfoTextLink className={styles.inlineLink} href={section.link.href}>
                    {section.link.label}
                  </InfoTextLink>
                </p>
              ) : null}
            </div>
          </section>
        ))}
        <RelatedLinks links={document.related} />
      </article>
    </ContentWidth>
  );
}

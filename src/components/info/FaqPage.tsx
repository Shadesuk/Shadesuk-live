import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { FAQ_GROUPS, FAQ_LEDE, FAQ_TITLE } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { RelatedLinks } from "./RelatedLinks";
import styles from "./InfoPage.module.css";

export function FaqPage() {
  return (
    <ContentWidth>
      <article className={styles.document}>
        <header className={styles.header}>
          <h1 className="text-h2">{FAQ_TITLE}</h1>
          <p className={`text-body ${styles.lede}`}>{FAQ_LEDE}</p>
        </header>
        <div className={styles.groups}>
          {FAQ_GROUPS.map((group) => (
            <section key={group.id} className={styles.group} aria-labelledby={group.id}>
              <h2 id={group.id} className="text-h3">
                {group.title}
              </h2>
              <div className={styles.list}>
                {group.items.map((item) => (
                  <details key={item.question} className={styles.item}>
                    <summary className="text-small">{item.question}</summary>
                    <div className={styles.panel}>
                      {item.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-small">
                          {paragraph}
                        </p>
                      ))}
                      {item.link ? (
                        <p className="text-small">
                          <Link className={styles.inlineLink} href={item.link.href}>
                            {item.link.label}
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <RelatedLinks
          links={[
            { href: routes.contact, label: "Contact" },
            { href: routes.shipping, label: "Shipping" },
            { href: routes.refunds, label: "Returns / Refunds" },
          ]}
        />
      </article>
    </ContentWidth>
  );
}

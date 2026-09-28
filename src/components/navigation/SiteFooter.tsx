import { ContentWidth } from "@/components/layout/ContentWidth";
import {
  ALL_MAJOR_CARDS,
  PAYMENTS_ACCEPTED,
  SECURE_CARD_PAYMENT,
} from "@/lib/checkout-copy";
import { footerSections } from "@/lib/navigation";
import { enabledPaymentMethods } from "@/lib/payment-methods";
import { BrandMark } from "./BrandMark";
import { NavLink } from "./NavLink";
import styles from "./SiteFooter.module.css";

const paymentLine = `${SECURE_CARD_PAYMENT}. ${ALL_MAJOR_CARDS}.`;

type FooterSection = (typeof footerSections)[number];

function FooterLinkList({
  links,
}: {
  links: readonly { href: string; label: string }[];
}) {
  return (
    <ul className={styles.list}>
      {links.map((item) => (
        <li key={item.href}>
          <NavLink href={item.href}>{item.label}</NavLink>
        </li>
      ))}
    </ul>
  );
}

function DesktopGroup({ section }: { section: FooterSection }) {
  if ("links" in section) {
    return (
      <nav className={styles.group} aria-labelledby={`footer-${section.id}`}>
        <h2 id={`footer-${section.id}`} className={`text-micro ${styles.heading}`}>
          {section.label}
        </h2>
        <FooterLinkList links={section.links} />
      </nav>
    );
  }

  return (
    <div className={styles.group}>
      <h2 className={`text-micro ${styles.heading}`}>{section.label}</h2>
      <p className={`text-small ${styles.note}`}>{section.note}</p>
    </div>
  );
}

function MobileGroup({ section }: { section: FooterSection }) {
  return (
    <details className={styles.accordion}>
      <summary className={styles.summary}>
        <span className={`text-micro ${styles.summaryLabel}`}>{section.label}</span>
      </summary>
      <div className={styles.panel}>
        {"links" in section ? (
          <nav aria-label={section.label}>
            <FooterLinkList links={section.links} />
          </nav>
        ) : (
          <p className={`text-small ${styles.note}`}>{section.note}</p>
        )}
      </div>
    </details>
  );
}

function MobilePaymentTrust() {
  const methods = enabledPaymentMethods();

  return (
    <div className={styles.trust}>
      <p className={`text-micro ${styles.trustHeading}`}>{SECURE_CARD_PAYMENT}</p>
      <p className={`text-small ${styles.note}`}>{ALL_MAJOR_CARDS}</p>
      {methods.length > 0 ? (
        <ul className={styles.marks} aria-label={PAYMENTS_ACCEPTED}>
          {methods.map((method) => (
            <li key={method.id} className={styles.markItem} data-method={method.id}>
              {method.markSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.mark} src={method.markSrc} alt={method.label} />
              ) : (
                <span className="text-micro">{method.label}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SiteFooter({ reduced = false }: { reduced?: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} data-reduced={reduced || undefined}>
      <ContentWidth>
        {reduced ? null : (
          <div className={styles.grid}>
            <div className={styles.brand}>
              <BrandMark />
              <p className={`text-small ${styles.note}`}>
                Modern eyewear. Quiet, confident, product-led.
              </p>
            </div>

            {footerSections.map((section) => (
              <DesktopGroup key={section.id} section={section} />
            ))}

            <div className={styles.accordions}>
              {footerSections.map((section) => (
                <MobileGroup key={section.id} section={section} />
              ))}
            </div>
          </div>
        )}

        {reduced ? null : <MobilePaymentTrust />}

        <div className={styles.bottom}>
          <p className={`text-small ${styles.legal}`}>
            © {year} SHADESUK. All rights reserved.
          </p>
          <p
            className={`text-small ${styles.legal}${reduced ? "" : ` ${styles.desktopPayment}`}`}
          >
            {paymentLine}
          </p>
        </div>
      </ContentWidth>
    </footer>
  );
}

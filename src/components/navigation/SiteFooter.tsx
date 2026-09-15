import { ContentWidth } from "@/components/layout/ContentWidth";
import { footerNav } from "@/lib/navigation";
import { BrandMark } from "./BrandMark";
import { NavLink } from "./NavLink";
import styles from "./SiteFooter.module.css";

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

          <nav className={styles.group} aria-labelledby="footer-shop">
            <h2 id="footer-shop" className={`text-micro ${styles.heading}`}>
              Shop
            </h2>
            <ul className={styles.list}>
              {footerNav.shop.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.group} aria-labelledby="footer-help">
            <h2 id="footer-help" className={`text-micro ${styles.heading}`}>
              Help
            </h2>
            <ul className={styles.list}>
              {footerNav.help.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.group} aria-labelledby="footer-company">
            <h2 id="footer-company" className={`text-micro ${styles.heading}`}>
              Company
            </h2>
            <ul className={styles.list}>
              {footerNav.company.map((item) => (
                <li key={item.href}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.group}>
            <h2 className={`text-micro ${styles.heading}`}>Social</h2>
            <p className={`text-small ${styles.note}`}>
              Official channels will be listed here when they are active.
            </p>
          </div>
        </div>
        )}

        <div className={styles.bottom}>
          <p className={`text-small ${styles.legal}`}>
            © {year} SHADESUK. All rights reserved.
          </p>
          <p className={`text-small ${styles.legal}`}>
            Secure card payment. All major cards accepted.
          </p>
        </div>
      </ContentWidth>
    </footer>
  );
}

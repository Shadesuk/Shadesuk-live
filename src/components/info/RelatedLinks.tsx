import Link from "next/link";
import type { InfoLink } from "@/lib/legal-copy";
import styles from "./InfoPage.module.css";

export function RelatedLinks({ links }: { links: readonly InfoLink[] }) {
  if (links.length === 0) {
    return null;
  }

  return (
    <nav className={styles.related} aria-labelledby="info-related">
      <h2 id="info-related" className="text-micro">
        Also
      </h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link className="text-small" href={link.href}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

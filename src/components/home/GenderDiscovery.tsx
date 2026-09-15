import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { genderLinks } from "@/lib/navigation";
import { MediaPlaceholder } from "./MediaPlaceholder";
import styles from "./GenderDiscovery.module.css";

export function GenderDiscovery() {
  return (
    <Section labelledBy="gender-heading">
      <ContentWidth className={styles.section}>
        <h2 id="gender-heading" className="text-h2">
          Shop by gender
        </h2>
        <ul className={styles.list}>
          {genderLinks.map((item) => (
            <li key={item.href}>
              <Link className={styles.card} href={item.href}>
                <MediaPlaceholder
                  label={`${item.label} photography`}
                  ratio="square"
                />
                <span className="text-h3">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ContentWidth>
    </Section>
  );
}

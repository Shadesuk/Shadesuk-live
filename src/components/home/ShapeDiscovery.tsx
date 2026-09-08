import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { Section } from "@/components/layout/Section";
import { shapeLinks } from "@/lib/navigation";
import { shapeLabel } from "@/services/collections";
import type { Shape } from "@/types/catalogue";
import styles from "./ShapeDiscovery.module.css";

type ShapeDiscoveryProps = {
  shapes: Shape[];
};

export function ShapeDiscovery({ shapes }: ShapeDiscoveryProps) {
  const items = shapeLinks.filter((link) =>
    shapes.includes(link.href.replace("/collections/", "") as Shape),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Section labelledBy="shape-heading">
      <ContentWidth className={styles.section}>
        <h2 id="shape-heading" className="text-h2">
          Find your frame
        </h2>
        <ul className={styles.list}>
          {items.map((item) => {
            const slug = item.href.replace("/collections/", "") as Shape;
            return (
              <li key={item.href}>
                <Link className={styles.link} href={item.href}>
                  {shapeLabel(slug)}
                </Link>
              </li>
            );
          })}
        </ul>
      </ContentWidth>
    </Section>
  );
}

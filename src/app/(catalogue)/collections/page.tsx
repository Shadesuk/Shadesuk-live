import type { Metadata } from "next";
import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCollectionBySlug, getCollectionProducts } from "@/services/collections";
import { SHAPES } from "@/types/catalogue";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Collections",
};

export default function CollectionsIndexPage() {
  const collections = SHAPES.map((slug) => getCollectionBySlug(slug)).filter(
    (collection): collection is NonNullable<typeof collection> => Boolean(collection),
  );

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth className={styles.page}>
          <header className={styles.header}>
            <h1 className="text-h2">Collections</h1>
            <p className="text-small">Shop by frame shape.</p>
          </header>
          <ul className={styles.list}>
            {collections.map((collection) => {
              const count = getCollectionProducts(collection).length;
              return (
                <li key={collection.id}>
                  <Link href={collection.href} className={styles.link}>
                    <span className="text-h3">{collection.title}</span>
                    <span className="text-micro">
                      {count} {count === 1 ? "shade" : "shades"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { SearchForm } from "@/components/search/SearchForm";
import type { SearchDiscoveryLink } from "@/lib/search-query";
import styles from "./SearchLanding.module.css";

export function SearchLanding({
  discovery = [],
}: {
  discovery?: SearchDiscoveryLink[];
}) {
  return (
    <PageContainer>
      <main id="main" className={styles.page}>
        <ContentWidth>
          <div className={styles.page}>
            <header className={styles.header}>
              <p className={`text-micro ${styles.kicker}`}>Search</p>
              <h1 className={`text-h2 ${styles.title}`}>Find a shade</h1>
              <p className={`text-body ${styles.lede}`}>
                Search by product, brand, colour, or shape. Results use the same
                filters and sort as the rest of the shop.
              </p>
            </header>
            <SearchForm
              initialQuery=""
              autoFocus
              discovery={discovery}
              variant="page"
            />
          </div>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

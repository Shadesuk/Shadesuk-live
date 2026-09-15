import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { LOADING_PAGE } from "@/lib/ui-state-copy";
import styles from "./RouteLoading.module.css";

export function RouteLoading({ label = LOADING_PAGE }: { label?: string }) {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <div className={styles.wrap} aria-busy="true">
            <p className="visually-hidden" role="status">
              {label}
            </p>
            <div className={styles.block} aria-hidden="true" />
            <div className={styles.line} aria-hidden="true" />
            <div className={`${styles.line} ${styles.short}`} aria-hidden="true" />
          </div>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ACCOUNT_TITLE } from "@/lib/account-copy";
import styles from "@/components/account/Account.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ACCOUNT_TITLE,
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <div className={styles.page}>{children}</div>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ACCOUNT_TITLE } from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import styles from "@/components/account/Account.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  ACCOUNT_TITLE,
  "Sign in or manage your SHADESUK account.",
  routes.account,
);

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

import type { ReactNode } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

export default function InfoLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <main id="main">{children}</main>
    </PageContainer>
  );
}

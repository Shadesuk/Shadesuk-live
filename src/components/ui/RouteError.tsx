"use client";

import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/ui/ErrorState";

type RouteErrorProps = {
  reset?: () => void;
  title?: string;
  description?: string;
};

export function RouteError({ reset, title, description }: RouteErrorProps) {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <ErrorState title={title} description={description} onRetry={reset} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

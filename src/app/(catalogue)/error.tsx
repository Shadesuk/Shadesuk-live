"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { CollectionErrorState } from "@/components/discovery/CollectionErrorState";

export default function CatalogueError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <CollectionErrorState onRetry={reset} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

"use client";

import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProductError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <EmptyState
            title="We couldn’t load this product."
            description="Please try again. The rest of the site remains available."
            actions={
              <Button variant="secondary" onClick={reset}>
                Try again
              </Button>
            }
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

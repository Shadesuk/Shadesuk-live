"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type CollectionErrorStateProps = {
  onRetry?: () => void;
};

export function CollectionErrorState({ onRetry }: CollectionErrorStateProps) {
  return (
    <EmptyState
      title="We couldn’t load this collection."
      description="Please try again. The rest of the site remains available."
      actions={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    />
  );
}

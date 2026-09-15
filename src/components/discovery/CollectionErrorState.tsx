"use client";

import { ErrorState } from "@/components/ui/ErrorState";

type CollectionErrorStateProps = {
  onRetry?: () => void;
};

export function CollectionErrorState({ onRetry }: CollectionErrorStateProps) {
  return (
    <ErrorState
      title="We couldn’t load this collection."
      description="Please try again. The rest of the site remains available."
      onRetry={onRetry}
    />
  );
}

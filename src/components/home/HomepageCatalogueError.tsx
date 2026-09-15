"use client";

import { ErrorState } from "@/components/ui/ErrorState";

type HomepageCatalogueErrorProps = {
  onRetry?: () => void;
};

export function HomepageCatalogueError({ onRetry }: HomepageCatalogueErrorProps) {
  return (
    <ErrorState
      title="We couldn’t load products."
      description="Please try again. Campaign and navigation remain available."
      titleAs="h2"
      onRetry={onRetry ?? (() => window.location.reload())}
    />
  );
}

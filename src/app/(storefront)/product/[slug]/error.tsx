"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function ProductError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      reset={reset}
      title="We couldn’t load this product."
      description="Please try again. The rest of the site remains available."
    />
  );
}

"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function InfoError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError reset={reset} />;
}

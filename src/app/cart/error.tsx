"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function CartError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError reset={reset} title="We couldn’t load your bag." />;
}

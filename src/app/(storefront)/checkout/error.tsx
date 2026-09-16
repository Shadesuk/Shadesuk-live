"use client";

import { RouteError } from "@/components/ui/RouteError";

export default function CheckoutError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError reset={reset} title="We couldn’t load checkout." />;
}

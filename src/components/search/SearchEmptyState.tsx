"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { track } from "@/lib/analytics";
import { routes } from "@/lib/navigation";

type SearchEmptyStateProps = {
  query: string;
};

export function SearchEmptyState({ query }: SearchEmptyStateProps) {
  useEffect(() => {
    if (query) {
      track("search_no_results", { query, result_count: 0 });
    }
  }, [query]);

  return (
    <EmptyState
      title={query ? `No results for “${query}”` : "No shades found."}
      description={
        query
          ? "Try a different search, or browse the catalogue."
          : "Try a different search, or browse the catalogue."
      }
      actions={
        <>
          <ButtonLink href={routes.search} variant="primary">
            Clear search
          </ButtonLink>
          <ButtonLink href={routes.shop} variant="secondary">
            View all shades
          </ButtonLink>
          <Link href={routes.bestSellers} className="text-small">
            Best sellers
          </Link>
          <Link href={routes.newArrivals} className="text-small">
            New arrivals
          </Link>
        </>
      }
    />
  );
}

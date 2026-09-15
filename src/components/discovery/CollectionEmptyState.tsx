"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import {
  collectionQueryPath,
  emptyCollectionQuery,
  hasUserFilters,
} from "@/lib/collection-query";
import type { CollectionDefinition, CollectionQuery } from "@/types/collection";

type CollectionEmptyStateProps = {
  collection: CollectionDefinition;
  query: CollectionQuery;
};

export function CollectionEmptyState({
  collection,
  query,
}: CollectionEmptyStateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const filtered = hasUserFilters(query, collection);

  if (!filtered) {
    return (
      <EmptyState
        title="No shades available."
        description="Explore all shades."
        actions={
          <ButtonLink href={routes.shop} variant="secondary">
            View all shades
          </ButtonLink>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No shades match these filters."
      description="Clear the current filters or browse the full catalogue."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() =>
              router.push(
                collectionQueryPath(pathname, {
                  ...emptyCollectionQuery(),
                  sort: query.sort,
                  q: query.q,
                }),
              )
            }
          >
            Clear filters
          </Button>
          <Link href={routes.shop} className="text-small">
            View all shades
          </Link>
        </>
      }
    />
  );
}

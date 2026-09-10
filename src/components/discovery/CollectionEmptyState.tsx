"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";
import { collectionQueryPath, emptyCollectionQuery } from "@/services/collections";
import type { CollectionQuery } from "@/types/collection";

type CollectionEmptyStateProps = {
  query: CollectionQuery;
};

export function CollectionEmptyState({ query }: CollectionEmptyStateProps) {
  const router = useRouter();
  const pathname = usePathname();

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

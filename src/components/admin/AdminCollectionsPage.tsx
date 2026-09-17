import { Suspense } from "react";
import type { AdminCollectionListQuery } from "@/contracts/admin/collections";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ADMIN_COLLECTIONS_ADD, ADMIN_COLLECTIONS_BODY, ADMIN_COLLECTIONS_TITLE } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminCollectionsTableSkeleton } from "./AdminCollectionsSkeletons";
import { AdminCollectionsList } from "./AdminCollectionsTable";
import styles from "./AdminCollections.module.css";

export function AdminCollectionsPage({ query }: { query: AdminCollectionListQuery }) {
  return (
    <div data-admin-collections>
      <AdminPageHeader
        title={ADMIN_COLLECTIONS_TITLE}
        description={ADMIN_COLLECTIONS_BODY}
        action={
          <ButtonLink href={routes.adminCollectionsNew} variant="primary">
            {ADMIN_COLLECTIONS_ADD}
          </ButtonLink>
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminCollectionsTableSkeleton />}>
          <AdminCollectionsList query={query} />
        </Suspense>
      </div>
    </div>
  );
}

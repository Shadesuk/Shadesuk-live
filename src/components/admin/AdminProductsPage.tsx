import { Suspense } from "react";
import type { AdminProductListQuery } from "@/contracts/admin/products";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ADMIN_PRODUCTS_ADD, ADMIN_PRODUCTS_BODY, ADMIN_PRODUCTS_TITLE } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminProductsTableSkeleton } from "./AdminProductsSkeletons";
import { AdminProductsList } from "./AdminProductsTable";
import styles from "./AdminProducts.module.css";

export function AdminProductsPage({ query }: { query: AdminProductListQuery }) {
  return (
    <div data-admin-products>
      <AdminPageHeader
        title={ADMIN_PRODUCTS_TITLE}
        description={ADMIN_PRODUCTS_BODY}
        action={
          <ButtonLink href={routes.adminProductsNew} variant="primary">
            {ADMIN_PRODUCTS_ADD}
          </ButtonLink>
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminProductsTableSkeleton />}>
          <AdminProductsList query={query} />
        </Suspense>
      </div>
    </div>
  );
}

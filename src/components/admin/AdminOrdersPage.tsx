import { Suspense } from "react";
import type { AdminOrderListQuery } from "@/contracts/admin/orders";
import { ADMIN_ORDERS_BODY, ADMIN_ORDERS_TITLE } from "@/lib/admin-copy";
import { AdminOrderFilters } from "./AdminOrderFilters";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminOrdersTableSkeleton } from "./AdminOrdersSkeletons";
import { AdminOrdersList } from "./AdminOrdersTable";
import styles from "./AdminOrders.module.css";

export function AdminOrdersPage({ query }: { query: AdminOrderListQuery }) {
  return (
    <div data-admin-orders>
      <AdminPageHeader title={ADMIN_ORDERS_TITLE} description={ADMIN_ORDERS_BODY} />
      <div className={styles.stack}>
        <AdminOrderFilters query={query} />
        <Suspense fallback={<AdminOrdersTableSkeleton />}>
          <AdminOrdersList query={query} />
        </Suspense>
      </div>
    </div>
  );
}

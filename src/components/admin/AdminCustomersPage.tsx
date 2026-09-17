import { Suspense } from "react";
import type { AdminCustomerListQuery } from "@/contracts/admin/customers";
import { ADMIN_CUSTOMERS_BODY, ADMIN_CUSTOMERS_TITLE } from "@/lib/admin-copy";
import { AdminCustomerFilters } from "./AdminCustomerFilters";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminCustomersTableSkeleton } from "./AdminCustomersSkeletons";
import { AdminCustomersList } from "./AdminCustomersTable";
import styles from "./AdminCustomers.module.css";

export function AdminCustomersPage({ query }: { query: AdminCustomerListQuery }) {
  return (
    <div data-admin-customers>
      <AdminPageHeader title={ADMIN_CUSTOMERS_TITLE} description={ADMIN_CUSTOMERS_BODY} />
      <div className={styles.stack}>
        <AdminCustomerFilters query={query} />
        <Suspense fallback={<AdminCustomersTableSkeleton />}>
          <AdminCustomersList query={query} />
        </Suspense>
      </div>
    </div>
  );
}

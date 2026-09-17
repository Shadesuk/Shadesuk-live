import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminCustomersPage } from "@/components/admin/AdminCustomersPage";
import { parseAdminCustomerListQuery } from "@/contracts/admin/customers";
import { ADMIN_CUSTOMERS_BODY, ADMIN_CUSTOMERS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_CUSTOMERS_TITLE,
  ADMIN_CUSTOMERS_BODY,
  routes.adminCustomers,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCustomersRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const query = parseAdminCustomerListQuery(await searchParams);
  return <AdminCustomersPage query={query} />;
}

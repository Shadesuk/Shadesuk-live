import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminOrdersPage } from "@/components/admin/AdminOrdersPage";
import { parseAdminOrderListQuery } from "@/contracts/admin/orders";
import { ADMIN_ORDERS_BODY, ADMIN_ORDERS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_ORDERS_TITLE,
  ADMIN_ORDERS_BODY,
  routes.adminOrders,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOrdersRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const query = parseAdminOrderListQuery(await searchParams);
  return <AdminOrdersPage query={query} />;
}

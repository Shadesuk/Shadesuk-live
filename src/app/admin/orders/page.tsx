import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "Orders",
  ADMIN_MODULE_LATER,
  routes.adminOrders,
);

export default function AdminOrdersPage() {
  return <AdminPlaceholderPage title="Orders" description={ADMIN_MODULE_LATER} />;
}

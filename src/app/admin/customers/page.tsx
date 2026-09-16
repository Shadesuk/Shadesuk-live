import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "Customers",
  ADMIN_MODULE_LATER,
  routes.adminCustomers,
);

export default function AdminCustomersPage() {
  return (
    <AdminPlaceholderPage title="Customers" description={ADMIN_MODULE_LATER} />
  );
}

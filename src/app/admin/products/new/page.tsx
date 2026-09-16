import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "New product",
  ADMIN_MODULE_LATER,
  routes.adminProductsNew,
);

export default function AdminNewProductPage() {
  return (
    <AdminPlaceholderPage
      kicker="Products"
      title="New product"
      description={ADMIN_MODULE_LATER}
    />
  );
}

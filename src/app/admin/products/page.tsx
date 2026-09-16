import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "Products",
  ADMIN_MODULE_LATER,
  routes.adminProducts,
);

export default function AdminProductsPage() {
  return (
    <AdminPlaceholderPage
      title="Products"
      description="Manage your product catalogue. This module ships in a later step."
    />
  );
}

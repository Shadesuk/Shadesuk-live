import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "Collections",
  ADMIN_MODULE_LATER,
  routes.adminCollections,
);

export default function AdminCollectionsPage() {
  return (
    <AdminPlaceholderPage title="Collections" description={ADMIN_MODULE_LATER} />
  );
}

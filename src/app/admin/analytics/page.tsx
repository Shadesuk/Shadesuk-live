import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_MODULE_LATER } from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  "Analytics",
  ADMIN_MODULE_LATER,
  routes.adminAnalytics,
);

export default function AdminAnalyticsPage() {
  return (
    <AdminPlaceholderPage title="Analytics" description={ADMIN_MODULE_LATER} />
  );
}

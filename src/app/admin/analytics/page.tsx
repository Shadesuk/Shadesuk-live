import type { Metadata } from "next";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { parseDashboardPeriod } from "@/contracts/admin/dashboard";
import { ADMIN_ANALYTICS_BODY, ADMIN_ANALYTICS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_ANALYTICS_TITLE,
  ADMIN_ANALYTICS_BODY,
  routes.adminAnalytics,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAnalyticsRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const params = await searchParams;
  const period = parseDashboardPeriod(params.period);
  return <AdminAnalytics period={period} />;
}

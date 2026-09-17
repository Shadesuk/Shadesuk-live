import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminCollectionsPage } from "@/components/admin/AdminCollectionsPage";
import { parseAdminCollectionListQuery } from "@/contracts/admin/collections";
import { ADMIN_COLLECTIONS_BODY, ADMIN_COLLECTIONS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_COLLECTIONS_TITLE,
  ADMIN_COLLECTIONS_BODY,
  routes.adminCollections,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCollectionsRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const query = parseAdminCollectionListQuery(await searchParams);
  return <AdminCollectionsPage query={query} />;
}

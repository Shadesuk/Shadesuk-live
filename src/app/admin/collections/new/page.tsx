import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminNewCollectionSection } from "@/components/admin/AdminCollectionEditorPage";
import { AdminCollectionEditorSkeleton } from "@/components/admin/AdminCollectionsSkeletons";
import { ADMIN_COLLECTION_NEW_TITLE, ADMIN_COLLECTIONS_BODY } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_COLLECTION_NEW_TITLE,
  ADMIN_COLLECTIONS_BODY,
  routes.adminCollectionsNew,
);

export default async function AdminNewCollectionPage() {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  return (
    <Suspense fallback={<AdminCollectionEditorSkeleton />}>
      <AdminNewCollectionSection role={gate.actor.role} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminCollectionDetailSection } from "@/components/admin/AdminCollectionEditorPage";
import { AdminCollectionEditorSkeleton } from "@/components/admin/AdminCollectionsSkeletons";
import { ADMIN_COLLECTIONS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { adminCollectionPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Collection", ADMIN_COLLECTIONS_TITLE, adminCollectionPath(id));
}

export default async function AdminCollectionDetailPage({ params }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const { id } = await params;
  return (
    <Suspense fallback={<AdminCollectionEditorSkeleton />}>
      <AdminCollectionDetailSection id={id} role={gate.actor.role} />
    </Suspense>
  );
}

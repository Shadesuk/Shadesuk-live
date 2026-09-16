import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminProductDetailSection } from "@/components/admin/AdminProductEditorPage";
import { AdminProductEditorSkeleton } from "@/components/admin/AdminProductsSkeletons";
import { ADMIN_PRODUCTS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { adminProductPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Product", ADMIN_PRODUCTS_TITLE, adminProductPath(id));
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const { id } = await params;
  return (
    <Suspense fallback={<AdminProductEditorSkeleton />}>
      <AdminProductDetailSection id={id} role={gate.actor.role} />
    </Suspense>
  );
}

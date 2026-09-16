import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminNewProductSection } from "@/components/admin/AdminProductEditorPage";
import { AdminProductEditorSkeleton } from "@/components/admin/AdminProductsSkeletons";
import { ADMIN_PRODUCT_NEW_TITLE, ADMIN_PRODUCTS_BODY } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_PRODUCT_NEW_TITLE,
  ADMIN_PRODUCTS_BODY,
  routes.adminProductsNew,
);

export default async function AdminNewProductPage() {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  return (
    <Suspense fallback={<AdminProductEditorSkeleton />}>
      <AdminNewProductSection role={gate.actor.role} />
    </Suspense>
  );
}

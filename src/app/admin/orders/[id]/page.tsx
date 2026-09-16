import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminOrderDetailSection } from "@/components/admin/AdminOrderDetail";
import { AdminOrderDetailSkeleton } from "@/components/admin/AdminOrdersSkeletons";
import { ADMIN_ORDERS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { adminOrderPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Order", ADMIN_ORDERS_TITLE, adminOrderPath(id));
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const { id } = await params;
  return (
    <Suspense fallback={<AdminOrderDetailSkeleton />}>
      <AdminOrderDetailSection id={id} />
    </Suspense>
  );
}

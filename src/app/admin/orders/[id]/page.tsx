import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_DETAIL_LATER } from "@/lib/admin-copy";
import { adminOrderPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Order", ADMIN_DETAIL_LATER, adminOrderPath(id));
}

export default function AdminOrderDetailPage() {
  return (
    <AdminPlaceholderPage
      kicker="Orders"
      title="Order"
      description={ADMIN_DETAIL_LATER}
    />
  );
}

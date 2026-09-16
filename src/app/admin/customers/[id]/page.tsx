import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_DETAIL_LATER } from "@/lib/admin-copy";
import { adminCustomerPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Customer", ADMIN_DETAIL_LATER, adminCustomerPath(id));
}

export default function AdminCustomerDetailPage() {
  return (
    <AdminPlaceholderPage
      kicker="Customers"
      title="Customer"
      description={ADMIN_DETAIL_LATER}
    />
  );
}

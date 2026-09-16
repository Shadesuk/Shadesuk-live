import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_DETAIL_LATER } from "@/lib/admin-copy";
import { adminProductPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Product", ADMIN_DETAIL_LATER, adminProductPath(id));
}

export default function AdminProductDetailPage() {
  return (
    <AdminPlaceholderPage
      kicker="Products"
      title="Product"
      description={ADMIN_DETAIL_LATER}
    />
  );
}

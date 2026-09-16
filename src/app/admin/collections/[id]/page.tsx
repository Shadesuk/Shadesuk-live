import type { Metadata } from "next";
import { AdminPlaceholderPage } from "@/components/admin/AdminPlaceholderPage";
import { ADMIN_DETAIL_LATER } from "@/lib/admin-copy";
import { adminCollectionPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Collection", ADMIN_DETAIL_LATER, adminCollectionPath(id));
}

export default function AdminCollectionDetailPage() {
  return (
    <AdminPlaceholderPage
      kicker="Collections"
      title="Collection"
      description={ADMIN_DETAIL_LATER}
    />
  );
}

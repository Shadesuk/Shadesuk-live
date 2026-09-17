import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminCustomerDetailSection } from "@/components/admin/AdminCustomerDetail";
import { AdminCustomerDetailSkeleton } from "@/components/admin/AdminCustomersSkeletons";
import { parseAdminCustomerOrdersPage } from "@/contracts/admin/customers";
import { ADMIN_CUSTOMERS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { adminCustomerPath } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return privatePathMetadata("Customer", ADMIN_CUSTOMERS_TITLE, adminCustomerPath(id));
}

export default async function AdminCustomerDetailPage({ params, searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const { id } = await params;
  const query = await searchParams;
  return (
    <Suspense fallback={<AdminCustomerDetailSkeleton />}>
      <AdminCustomerDetailSection id={id} ordersPage={parseAdminCustomerOrdersPage(query.page)} />
    </Suspense>
  );
}

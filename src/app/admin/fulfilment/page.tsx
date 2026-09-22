import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminFulfilmentPage } from "@/components/admin/AdminFulfilmentPage";
import { parseFulfilmentView, parseOpsPage } from "@/contracts/admin/ops";
import { ADMIN_FULFILMENT_BODY, ADMIN_FULFILMENT_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_FULFILMENT_TITLE,
  ADMIN_FULFILMENT_BODY,
  routes.adminFulfilment,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminFulfilmentRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const params = await searchParams;
  return <AdminFulfilmentPage view={parseFulfilmentView(params)} page={parseOpsPage(params)} />;
}

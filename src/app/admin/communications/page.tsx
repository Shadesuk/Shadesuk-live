import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminCommunicationsPage } from "@/components/admin/AdminCommunicationsPage";
import { parseCommunicationView, parseOpsPage } from "@/contracts/admin/ops";
import { ADMIN_COMMS_BODY, ADMIN_COMMS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_COMMS_TITLE,
  ADMIN_COMMS_BODY,
  routes.adminCommunications,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCommunicationsRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const params = await searchParams;
  return <AdminCommunicationsPage view={parseCommunicationView(params)} page={parseOpsPage(params)} />;
}

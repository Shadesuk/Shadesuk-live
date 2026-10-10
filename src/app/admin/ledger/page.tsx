import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminLedgerPage } from "@/components/admin/AdminLedger";
import { parseLedgerListQuery } from "@/contracts/admin/ledger";
import { ADMIN_LEDGER_BODY, ADMIN_LEDGER_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(ADMIN_LEDGER_TITLE, ADMIN_LEDGER_BODY, routes.adminLedger);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLedgerRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const query = parseLedgerListQuery(await searchParams);
  return <AdminLedgerPage query={query} />;
}

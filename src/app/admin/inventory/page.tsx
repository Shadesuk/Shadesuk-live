import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminInventoryPage } from "@/components/admin/AdminInventoryPage";
import { inventoryStockDescription, parseInventoryView, parseOpsPage } from "@/contracts/admin/ops";
import { ADMIN_INVENTORY_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_INVENTORY_TITLE,
  inventoryStockDescription(),
  routes.adminInventory,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminInventoryRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const params = await searchParams;
  return <AdminInventoryPage view={parseInventoryView(params)} page={parseOpsPage(params)} />;
}

import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminProductsPage } from "@/components/admin/AdminProductsPage";
import { parseAdminProductListQuery } from "@/contracts/admin/products";
import { ADMIN_PRODUCTS_BODY, ADMIN_PRODUCTS_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_PRODUCTS_TITLE,
  ADMIN_PRODUCTS_BODY,
  routes.adminProducts,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminProductsRoute({ searchParams }: PageProps) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  const query = parseAdminProductListQuery(await searchParams);
  return <AdminProductsPage query={query} />;
}

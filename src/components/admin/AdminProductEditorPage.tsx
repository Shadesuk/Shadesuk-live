import type { AdminV1Role } from "@/contracts/admin/roles";
import { loadAdminNewProduct, loadAdminProductDetail } from "@/services/admin-products";
import { AdminProductEditor } from "./AdminProductEditor";
import { AdminProductNotFound } from "./AdminProductNotFound";
import { AdminProductsUnavailable } from "./AdminProductsUnavailable";

export async function AdminNewProductSection({ role }: { role: AdminV1Role }) {
  const result = await loadAdminNewProduct();
  if (result.status !== "ok") {
    return <AdminProductsUnavailable />;
  }
  return (
    <AdminProductEditor
      product={null}
      role={role}
      collections={result.data.collections}
      images={[]}
    />
  );
}

export async function AdminProductDetailSection({
  id,
  role,
  notice,
}: {
  id: string;
  role: AdminV1Role;
  notice?: string;
}) {
  const result = await loadAdminProductDetail(id);
  if (result.status === "not_found") {
    return <AdminProductNotFound />;
  }
  if (result.status !== "ok") {
    return <AdminProductsUnavailable />;
  }
  return (
    <AdminProductEditor
      product={result.data}
      role={role}
      collections={result.data.collections}
      images={result.data.images}
      notice={notice}
    />
  );
}

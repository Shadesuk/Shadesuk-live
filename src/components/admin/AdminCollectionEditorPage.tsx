import type { AdminV1Role } from "@/contracts/admin/roles";
import { loadAdminCollectionDetail } from "@/services/admin-collections";
import { AdminCollectionEditor } from "./AdminCollectionEditor";
import { AdminCollectionNotFound } from "./AdminCollectionNotFound";
import { AdminCollectionsUnavailable } from "./AdminCollectionsUnavailable";

export function AdminNewCollectionSection({ role }: { role: AdminV1Role }) {
  return <AdminCollectionEditor collection={null} role={role} />;
}

export async function AdminCollectionDetailSection({
  id,
  role,
}: {
  id: string;
  role: AdminV1Role;
}) {
  const result = await loadAdminCollectionDetail(id);
  if (result.status === "not_found") {
    return <AdminCollectionNotFound />;
  }
  if (result.status !== "ok") {
    return <AdminCollectionsUnavailable />;
  }
  return <AdminCollectionEditor collection={result.data} role={role} />;
}

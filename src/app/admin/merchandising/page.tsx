import type { Metadata } from "next";
import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminForbidden } from "@/components/admin/AdminForbidden";
import { AdminMerchandisingPage } from "@/components/admin/AdminMerchandisingPage";
import { canAccessMerchandising } from "@/contracts/admin/roles";
import {
  ADMIN_MERCHANDISING_BODY,
  ADMIN_MERCHANDISING_FORBIDDEN,
  ADMIN_MERCHANDISING_HEADING,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_MERCHANDISING_HEADING,
  ADMIN_MERCHANDISING_BODY,
  routes.adminMerchandising,
);

export default async function AdminMerchandisingRoute() {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthScreen gate={gate} />;
  }
  if (!canAccessMerchandising(gate.actor.role)) {
    return (
      <AdminForbidden
        actor={gate.actor}
        message={ADMIN_MERCHANDISING_FORBIDDEN}
        embedded
      />
    );
  }
  return <AdminMerchandisingPage role={gate.actor.role} />;
}

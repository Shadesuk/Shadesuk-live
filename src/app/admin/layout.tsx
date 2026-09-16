import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminAuthFrame } from "@/components/admin/AdminAuthFrame";
import { ADMIN_TITLE } from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  ADMIN_TITLE,
  "SHADESUK Admin.",
  routes.admin,
);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return <AdminAuthFrame>{children}</AdminAuthFrame>;
  }
  return <AdminShell actor={gate.actor}>{children}</AdminShell>;
}

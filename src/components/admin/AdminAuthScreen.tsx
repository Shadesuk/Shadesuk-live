import type { AdminGate } from "@/lib/admin-session";
import { AdminForbidden } from "./AdminForbidden";
import { AdminSignInForm } from "./AdminSignInForm";

export function AdminAuthScreen({ gate }: { gate: AdminGate }) {
  if (gate.status === "ok") {
    return null;
  }
  if (gate.status === "forbidden") {
    return <AdminForbidden email={gate.email} />;
  }
  return <AdminSignInForm />;
}

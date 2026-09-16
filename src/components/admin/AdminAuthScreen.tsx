import type { AdminGate } from "@/lib/admin-session";
import { AdminForbidden } from "./AdminForbidden";
import { AdminFoundation } from "./AdminFoundation";
import { AdminSignInForm } from "./AdminSignInForm";

export function AdminAuthScreen({ gate }: { gate: AdminGate }) {
  if (gate.status === "ok") {
    return <AdminFoundation actor={gate.actor} />;
  }
  if (gate.status === "forbidden") {
    return <AdminForbidden email={gate.email} />;
  }
  return <AdminSignInForm />;
}

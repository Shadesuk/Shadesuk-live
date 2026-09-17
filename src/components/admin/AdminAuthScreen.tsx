import { ADMIN_TITLE, ADMIN_UNAVAILABLE } from "@/lib/admin-copy";
import type { AdminGate } from "@/lib/admin-session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AdminForbidden } from "./AdminForbidden";
import { AdminSignInForm } from "./AdminSignInForm";
import styles from "./AdminAuth.module.css";

export function AdminAuthScreen({ gate }: { gate: AdminGate }) {
  if (gate.status === "ok") {
    return null;
  }
  if (gate.status === "forbidden") {
    return <AdminForbidden email={gate.email} />;
  }
  if (!isSupabaseConfigured()) {
    return (
      <div className={styles.stack} data-admin-auth-unconfigured>
        <p className={styles.kicker}>{ADMIN_TITLE}</p>
        <h1 className={`text-h2 ${styles.heading}`}>Admin sign in</h1>
        <p className={`text-small ${styles.body}`} role="alert">
          {ADMIN_UNAVAILABLE}
        </p>
      </div>
    );
  }
  return <AdminSignInForm />;
}

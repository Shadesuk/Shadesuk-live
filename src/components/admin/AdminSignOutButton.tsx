import { adminSignOutAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { ADMIN_SIGN_OUT_ACTION } from "@/lib/admin-copy";

export function AdminSignOutButton() {
  return (
    <form action={adminSignOutAction}>
      <Button type="submit" variant="tertiary">
        {ADMIN_SIGN_OUT_ACTION}
      </Button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ADMIN_DASHBOARD_RETRY } from "@/lib/admin-copy";

export function AdminRetryButton() {
  const router = useRouter();
  return (
    <Button type="button" variant="secondary" onClick={() => router.refresh()}>
      {ADMIN_DASHBOARD_RETRY}
    </Button>
  );
}

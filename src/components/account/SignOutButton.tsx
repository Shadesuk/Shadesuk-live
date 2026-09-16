"use client";

import { signOutAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/Button";
import { SIGN_OUT_ACTION } from "@/lib/account-copy";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="tertiary">
        {SIGN_OUT_ACTION}
      </Button>
    </form>
  );
}

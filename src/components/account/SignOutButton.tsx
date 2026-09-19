"use client";

import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/Button";
import { SIGN_OUT_ACTION } from "@/lib/account-copy";

export function SignOutButton({ label = SIGN_OUT_ACTION }: { label?: string }) {
  return (
    <form action={signOutAction}>
      <SignOutSubmit label={label} />
    </form>
  );
}

function SignOutSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="tertiary" loading={pending}>
      {label}
    </Button>
  );
}

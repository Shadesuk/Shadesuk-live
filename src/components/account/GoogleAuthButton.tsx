"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { signInWithGoogleAction } from "@/app/(storefront)/account/actions";
import { CONTINUE_WITH_GOOGLE, GOOGLE_FAILED } from "@/lib/account-copy";

type GoogleAuthButtonProps = {
  next?: string;
  disabled?: boolean;
  onError: (message: string) => void;
};

export function GoogleAuthButton({ next, disabled, onError }: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending || disabled) {
      return;
    }
    setPending(true);
    const result = await signInWithGoogleAction(next ? { next } : undefined);
    if (result.status === "oauth") {
      window.location.assign(result.url);
      return;
    }
    setPending(false);
    onError(result.status === "error" ? result.message : GOOGLE_FAILED);
  }

  return (
    <Button type="button" variant="secondary" loading={pending} disabled={disabled} onClick={handleClick}>
      {CONTINUE_WITH_GOOGLE}
    </Button>
  );
}

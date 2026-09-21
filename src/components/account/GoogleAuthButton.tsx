"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GoogleMark } from "@/components/account/GoogleMark";
import { signInWithGoogleAction } from "@/app/(storefront)/account/actions";
import { CONTINUE_WITH_GOOGLE, GOOGLE_FAILED } from "@/lib/account-copy";
import styles from "./Account.module.css";

type GoogleAuthButtonProps = {
  next?: string;
  disabled?: boolean;
  onError: (message: string) => void;
  onBeforeAuth?: () => Promise<void> | void;
};

export function GoogleAuthButton({ next, disabled, onError, onBeforeAuth }: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending || disabled) {
      return;
    }
    setPending(true);
    try {
      await onBeforeAuth?.();
    } catch {
      setPending(false);
      onError(GOOGLE_FAILED);
      return;
    }
    const result = await signInWithGoogleAction(next ? { next } : undefined);
    if (result.status === "oauth") {
      window.location.assign(result.url);
      return;
    }
    setPending(false);
    onError(result.status === "error" ? result.message : GOOGLE_FAILED);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className={styles.googleButton}
      loading={pending}
      disabled={disabled}
      onClick={handleClick}
    >
      <GoogleMark />
      {CONTINUE_WITH_GOOGLE}
    </Button>
  );
}

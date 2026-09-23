"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GoogleMark } from "@/components/account/GoogleMark";
import { signInWithGoogleAction } from "@/app/(storefront)/account/actions";
import { CONTINUE_WITH_GOOGLE, GOOGLE_FAILED } from "@/lib/account-copy";
import { isFrameworkRedirect } from "@/lib/auth-return";
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
      const result = await signInWithGoogleAction(next ? { next } : undefined);
      if (result.status === "oauth") {
        window.location.assign(result.url);
        return;
      }
      setPending(false);
      onError(result.status === "error" ? result.message : GOOGLE_FAILED);
    } catch (error) {
      // redirect() rejects the action promise and the router is already
      // navigating to Google. Surfacing that rejection is the false failure.
      if (isFrameworkRedirect(error)) {
        return;
      }
      setPending(false);
      onError(GOOGLE_FAILED);
    }
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

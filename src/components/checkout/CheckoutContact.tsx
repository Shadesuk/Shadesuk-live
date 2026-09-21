"use client";

import { useState, type FormEvent } from "react";
import { saveCheckoutContactAction } from "@/app/(storefront)/checkout/actions";
import { GoogleAuthButton } from "@/components/account/GoogleAuthButton";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import { AUTH_OR } from "@/lib/account-copy";
import {
  CONTACT_HEADING,
  CONTINUE,
  CONTINUE_AS_GUEST,
  EMAIL_LABEL,
  HAVE_ACCOUNT_PROMPT,
  SIGN_IN,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import type { CheckoutFieldErrors } from "@/types/checkout";
import styles from "./CheckoutContact.module.css";

type CheckoutContactProps = {
  email: string;
  errors?: CheckoutFieldErrors;
  pending?: boolean;
  signedIn?: boolean;
  authNotice?: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => Promise<void>;
};

export function CheckoutContact({
  email,
  errors,
  pending = false,
  signedIn = false,
  authNotice = "",
  onEmailChange,
  onSubmit,
}: CheckoutContactProps) {
  const [submitted, setSubmitted] = useState(false);
  const [googleError, setGoogleError] = useState(authNotice);
  const signInHref = `${routes.account}?next=${encodeURIComponent(routes.checkout)}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitted) {
      return;
    }
    setSubmitted(true);
    try {
      await onSubmit();
    } finally {
      setSubmitted(false);
    }
  }

  async function persistEnteredEmail() {
    if (!email.trim()) {
      return;
    }
    await saveCheckoutContactAction({ email });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-checkout-contact>
      <h2 className="text-h3">{CONTACT_HEADING}</h2>
      {googleError ? (
        <p className="text-small" role="alert">
          {googleError}
        </p>
      ) : null}
      <Field
        id="checkout-email"
        name="email"
        type="email"
        label={EMAIL_LABEL}
        autoComplete="email"
        inputMode="email"
        value={email}
        required
        disabled={pending}
        error={errors?.email}
        onChange={(event) => onEmailChange(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {signedIn ? CONTINUE : CONTINUE_AS_GUEST}
        </Button>
        {signedIn ? null : (
          <>
            <p className={`text-micro ${styles.divider}`}>{AUTH_OR}</p>
            <GoogleAuthButton
              next={routes.checkout}
              disabled={pending}
              onError={setGoogleError}
              onBeforeAuth={persistEnteredEmail}
            />
            <p className="text-small">
              {HAVE_ACCOUNT_PROMPT}{" "}
              <ButtonLink href={signInHref} variant="tertiary">
                {SIGN_IN}
              </ButtonLink>
            </p>
          </>
        )}
      </div>
    </form>
  );
}

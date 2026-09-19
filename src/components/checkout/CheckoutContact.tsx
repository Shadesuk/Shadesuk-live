"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
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
  onEmailChange: (email: string) => void;
  onSubmit: () => Promise<void>;
};

export function CheckoutContact({
  email,
  errors,
  pending = false,
  signedIn = false,
  onEmailChange,
  onSubmit,
}: CheckoutContactProps) {
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitted) {
      return;
    }
    setSubmitted(true);
    await onSubmit();
    setSubmitted(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-checkout-contact>
      <h2 className="text-h3">{CONTACT_HEADING}</h2>
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
          <p className="text-small">
            {HAVE_ACCOUNT_PROMPT}{" "}
            <ButtonLink href={routes.account} variant="tertiary">
              {SIGN_IN}
            </ButtonLink>
          </p>
        )}
      </div>
    </form>
  );
}

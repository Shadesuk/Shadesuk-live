"use client";

import { useState, type FormEvent } from "react";
import { requestPasswordResetAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import {
  EMAIL_LABEL,
  FORGOT_PASSWORD_BODY,
  FORGOT_PASSWORD_HEADING,
  RESET_SENT_BODY,
  RESET_SENT_TITLE,
  SEND_RESET_ACTION,
  SIGN_IN_ACTION,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountFieldErrors } from "@/types/account";
import styles from "./Account.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    const result = await requestPasswordResetAction({ email });
    if (result.status === "invalid") {
      setErrors(result.errors);
      setPending(false);
      return;
    }
    setErrors({});
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <div className={styles.form} role="status" data-password-reset-sent>
        <h1 className="text-h2">{RESET_SENT_TITLE}</h1>
        <p className="text-body">{RESET_SENT_BODY}</p>
        <ButtonLink href={routes.account} variant="secondary">
          {SIGN_IN_ACTION}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-forgot>
      <h1 className="text-h2">{FORGOT_PASSWORD_HEADING}</h1>
      <p className="text-body">{FORGOT_PASSWORD_BODY}</p>
      <Field
        id="reset-email"
        name="email"
        type="email"
        label={EMAIL_LABEL}
        autoComplete="email"
        inputMode="email"
        value={email}
        required
        disabled={pending}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {SEND_RESET_ACTION}
        </Button>
        <ButtonLink href={routes.account} variant="tertiary">
          {SIGN_IN_ACTION}
        </ButtonLink>
      </div>
    </form>
  );
}

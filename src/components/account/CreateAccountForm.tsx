"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/app/(storefront)/account/actions";
import { GoogleAuthButton } from "@/components/account/GoogleAuthButton";
import { PasswordField } from "@/components/account/PasswordField";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import {
  ACCOUNT_CREATE_FAILED,
  AUTH_OR,
  CONFIRM_EMAIL_BODY,
  CONFIRM_EMAIL_TITLE,
  CREATE_ACCOUNT_ACTION,
  CREATE_ACCOUNT_HEADING,
  EMAIL_LABEL,
  FIRST_NAME_LABEL,
  HAVE_ACCOUNT_PROMPT,
  LAST_NAME_LABEL,
  PASSWORD_LABEL,
  SIGN_IN_ACTION,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountFieldErrors } from "@/types/account";
import styles from "./Account.module.css";

type CreateAccountFormProps = {
  next?: string;
};

export function CreateAccountForm({ next }: CreateAccountFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setFormError("");
    const result = await registerAction({ firstName, lastName, email, password, next });
    if (result.status === "ok" && result.redirectTo) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    if (result.status === "confirm_email") {
      setConfirmEmail(true);
      setPending(false);
      return;
    }
    if (result.status === "invalid") {
      setErrors(result.errors);
      setPending(false);
      return;
    }
    setErrors({});
    setFormError(result.status === "error" ? result.message : ACCOUNT_CREATE_FAILED);
    setPending(false);
  }

  if (confirmEmail) {
    return (
      <div className={styles.form} role="status">
        <h1 className="text-h2">{CONFIRM_EMAIL_TITLE}</h1>
        <p className="text-body">{CONFIRM_EMAIL_BODY}</p>
        <ButtonLink href={routes.account} variant="secondary">
          {SIGN_IN_ACTION}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-register>
      <h1 className="text-h2">{CREATE_ACCOUNT_HEADING}</h1>
      {formError ? (
        <p className="text-small" role="alert">
          {formError}
        </p>
      ) : null}
      <Field
        id="register-first-name"
        name="firstName"
        label={FIRST_NAME_LABEL}
        autoComplete="given-name"
        value={firstName}
        required
        disabled={pending}
        error={errors.firstName}
        onChange={(event) => setFirstName(event.target.value)}
      />
      <Field
        id="register-last-name"
        name="lastName"
        label={LAST_NAME_LABEL}
        autoComplete="family-name"
        value={lastName}
        required
        disabled={pending}
        error={errors.lastName}
        onChange={(event) => setLastName(event.target.value)}
      />
      <Field
        id="register-email"
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
      <PasswordField
        id="register-password"
        name="password"
        label={PASSWORD_LABEL}
        autoComplete="new-password"
        value={password}
        required
        disabled={pending}
        error={errors.password}
        onChange={setPassword}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {CREATE_ACCOUNT_ACTION}
        </Button>
        <p className={`text-micro ${styles.divider}`}>{AUTH_OR}</p>
        <GoogleAuthButton next={next} disabled={pending} onError={setFormError} />
        <p className="text-small">
          {HAVE_ACCOUNT_PROMPT}{" "}
          <ButtonLink
            href={next ? `${routes.account}?next=${encodeURIComponent(next)}` : routes.account}
            variant="tertiary"
          >
            {SIGN_IN_ACTION}
          </ButtonLink>
        </p>
      </div>
    </form>
  );
}

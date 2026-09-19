"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/(storefront)/account/actions";
import { GoogleAuthButton } from "@/components/account/GoogleAuthButton";
import { PasswordField } from "@/components/account/PasswordField";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field } from "@/components/ui/Field";
import {
  AUTH_OR,
  CREATE_ACCOUNT_ACTION,
  CREDENTIALS_INVALID,
  EMAIL_LABEL,
  FORGOT_PASSWORD_LINK,
  NO_ACCOUNT_PROMPT,
  PASSWORD_LABEL,
  SIGN_IN_ACTION,
  SIGN_IN_HEADING,
  TRACK_ORDER_LINK,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountFieldErrors } from "@/types/account";
import styles from "./Account.module.css";

type SignInFormProps = {
  next?: string;
  notice?: string;
};

export function SignInForm({ next, notice }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [formError, setFormError] = useState(notice ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setFormError("");
    const result = await signInAction({ email, password, next });
    if (result.status === "ok" && result.redirectTo) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    if (result.status === "invalid") {
      setErrors(result.errors);
      setPending(false);
      return;
    }
    setErrors({});
    setFormError(result.status === "error" ? result.message : CREDENTIALS_INVALID);
    setPending(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-sign-in>
      <h1 className="text-h2">{SIGN_IN_HEADING}</h1>
      {formError ? (
        <p className="text-small" role="alert">
          {formError}
        </p>
      ) : null}
      <Field
        id="account-email"
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
        id="account-password"
        name="password"
        label={PASSWORD_LABEL}
        autoComplete="current-password"
        value={password}
        required
        disabled={pending}
        error={errors.password}
        onChange={setPassword}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {SIGN_IN_ACTION}
        </Button>
        <ButtonLink href={routes.accountForgotPassword} variant="tertiary">
          {FORGOT_PASSWORD_LINK}
        </ButtonLink>
        <p className={`text-micro ${styles.divider}`}>{AUTH_OR}</p>
        <GoogleAuthButton next={next} disabled={pending} onError={setFormError} />
        <ButtonLink href={routes.trackOrder} variant="tertiary">
          {TRACK_ORDER_LINK}
        </ButtonLink>
        <p className="text-small">
          {NO_ACCOUNT_PROMPT}{" "}
          <ButtonLink
            href={next ? `${routes.accountRegister}?next=${encodeURIComponent(next)}` : routes.accountRegister}
            variant="tertiary"
          >
            {CREATE_ACCOUNT_ACTION}
          </ButtonLink>
        </p>
      </div>
    </form>
  );
}

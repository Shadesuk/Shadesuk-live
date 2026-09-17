"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminSignInAction } from "@/app/admin/actions";
import { PasswordField } from "@/components/account/PasswordField";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  ADMIN_CREDENTIALS_INVALID,
  ADMIN_EMAIL_LABEL,
  ADMIN_PASSWORD_LABEL,
  ADMIN_SIGN_IN_ACTION,
  ADMIN_SIGN_IN_HEADING,
  ADMIN_TITLE,
} from "@/lib/admin-copy";
import type { AccountFieldErrors } from "@/types/account";
import styles from "./AdminAuth.module.css";

export function AdminSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [debug, setDebug] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setFormError("");
    setDebug("");
    const result = await adminSignInAction({ email, password, next: "/admin" });
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
    setFormError(
      result.status === "error" ? result.message : ADMIN_CREDENTIALS_INVALID,
    );
    if (result.status === "error" && result.debug && process.env.NODE_ENV !== "production") {
      setDebug(result.debug);
    }
    setPending(false);
  }

  return (
    <div className={styles.stack}>
      <p className={styles.kicker}>{ADMIN_TITLE}</p>
      <form className={styles.form} onSubmit={handleSubmit} noValidate data-admin-sign-in>
        <h1 className={`text-h2 ${styles.heading}`}>{ADMIN_SIGN_IN_HEADING}</h1>
        {formError ? (
          <p className="text-small" role="alert">
            {formError}
          </p>
        ) : null}
        {debug ? (
          <p className="text-small" data-admin-auth-debug>
            {debug}
          </p>
        ) : null}
        <Field
          id="admin-email"
          name="email"
          type="email"
          label={ADMIN_EMAIL_LABEL}
          autoComplete="username"
          inputMode="email"
          value={email}
          required
          disabled={pending}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          id="admin-password"
          name="password"
          label={ADMIN_PASSWORD_LABEL}
          autoComplete="current-password"
          value={password}
          required
          disabled={pending}
          error={errors.password}
          onChange={setPassword}
        />
        <div className={styles.actions}>
          <Button type="submit" loading={pending}>
            {ADMIN_SIGN_IN_ACTION}
          </Button>
        </div>
      </form>
    </div>
  );
}

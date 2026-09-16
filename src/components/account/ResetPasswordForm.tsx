"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updatePasswordAction } from "@/app/(storefront)/account/actions";
import { PasswordField } from "@/components/account/PasswordField";
import { Button } from "@/components/ui/Button";
import {
  NETWORK_ERROR,
  NEW_PASSWORD_LABEL,
  PASSWORD_UPDATED,
  RESET_PASSWORD_HEADING,
  SAVE_PASSWORD_ACTION,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountFieldErrors } from "@/types/account";
import styles from "./Account.module.css";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setFormError("");
    const result = await updatePasswordAction({ password });
    if (result.status === "ok") {
      router.replace(`${routes.account}?notice=password`);
      router.refresh();
      return;
    }
    if (result.status === "invalid") {
      setErrors(result.errors);
      setPending(false);
      return;
    }
    setErrors({});
    setFormError(result.status === "error" ? result.message : NETWORK_ERROR);
    setPending(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-reset>
      <h1 className="text-h2">{RESET_PASSWORD_HEADING}</h1>
      {formError ? (
        <p className="text-small" role="alert">
          {formError}
        </p>
      ) : null}
      <PasswordField
        id="new-password"
        name="password"
        label={NEW_PASSWORD_LABEL}
        autoComplete="new-password"
        value={password}
        required
        disabled={pending}
        error={errors.password}
        onChange={setPassword}
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {SAVE_PASSWORD_ACTION}
        </Button>
      </div>
      <p className="visually-hidden">{PASSWORD_UPDATED}</p>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { savePersonalDetailsAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  EMAIL_LABEL,
  FIRST_NAME_LABEL,
  LAST_NAME_LABEL,
  NETWORK_ERROR,
  PERSONAL_DETAILS_LABEL,
  SAVE_CHANGES,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountFieldErrors, AccountProfile } from "@/types/account";
import styles from "./Account.module.css";

export function PersonalDetailsForm({ profile }: { profile: AccountProfile }) {
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setMessage("");
    const result = await savePersonalDetailsAction({ firstName, lastName });
    if (result.status === "unauthenticated") {
      window.location.assign(routes.account);
      return;
    }
    if (result.status === "invalid") {
      setErrors(result.errors);
      setPending(false);
      return;
    }
    if (result.status === "ok") {
      setErrors({});
      setMessage(result.message ?? "");
      setPending(false);
      return;
    }
    setErrors({});
    setMessage(result.message || NETWORK_ERROR);
    setPending(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-details>
      <h1 className="text-h2">{PERSONAL_DETAILS_LABEL}</h1>
      {message ? (
        <p className="text-small" role="status">
          {message}
        </p>
      ) : null}
      <Field
        id="details-first-name"
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
        id="details-last-name"
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
        id="details-email"
        name="email"
        type="email"
        label={EMAIL_LABEL}
        autoComplete="email"
        value={profile.email}
        disabled
      />
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {SAVE_CHANGES}
        </Button>
      </div>
    </form>
  );
}

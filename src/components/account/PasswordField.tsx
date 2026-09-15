"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HIDE_PASSWORD, SHOW_PASSWORD } from "@/lib/account-copy";
import styles from "./Account.module.css";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
};

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  error,
  disabled,
  required,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.passwordWrap}>
      <Field
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        label={label}
        autoComplete={autoComplete}
        value={value}
        required={required}
        disabled={disabled}
        error={error}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="button"
        variant="tertiary"
        className={styles.passwordToggle}
        disabled={disabled}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? HIDE_PASSWORD : SHOW_PASSWORD}
      </Button>
    </div>
  );
}

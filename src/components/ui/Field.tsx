import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import styles from "./Field.module.css";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: ReactNode;
};

export function Field({
  id,
  label,
  error,
  hint,
  className,
  required,
  ...props
}: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? <span className="visually-hidden"> required</span> : null}
      </label>
      <input
        id={id}
        className={cx(styles.input, className)}
        required={required}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint ? (
        <p id={hintId} className={`text-small ${styles.hint}`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={`text-small ${styles.error}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type FieldSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
};

export function FieldSelect({
  id,
  label,
  error,
  required,
  className,
  children,
  ...props
}: FieldSelectProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? <span className="visually-hidden"> required</span> : null}
      </label>
      <select
        id={id}
        className={cx(styles.select, className)}
        required={required}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className={`text-small ${styles.error}`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "tertiary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({
  children,
  className,
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cx(styles.button, styles[variant], className)}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      <span>
        {children}
        {loading ? "…" : null}
      </span>
    </button>
  );
}

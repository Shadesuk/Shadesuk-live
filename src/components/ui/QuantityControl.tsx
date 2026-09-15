"use client";

import { useId } from "react";
import { cx } from "@/lib/cx";
import styles from "./QuantityControl.module.css";

type QuantityControlProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  labelledBy?: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (next: number) => void;
};

export function QuantityControl({
  value,
  min = 1,
  max,
  disabled = false,
  label,
  labelledBy,
  decreaseLabel,
  increaseLabel,
  onChange,
}: QuantityControlProps) {
  const generatedId = useId();
  const labelId = labelledBy ?? (label ? generatedId : undefined);

  return (
    <div className={styles.control}>
      {label ? (
        <span className={`text-micro ${styles.label}`} id={labelId}>
          {label}
        </span>
      ) : null}
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.button}
          aria-label={decreaseLabel}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span
          className={cx("text-small", styles.value)}
          aria-labelledby={labelId}
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          className={styles.button}
          aria-label={increaseLabel}
          disabled={disabled || (max != null && value >= max)}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

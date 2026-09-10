import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import styles from "./SearchInput.module.css";

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function SearchInput({
  id = "site-search-input",
  label = "Search shades",
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={cx(styles.input, className)}
        type="search"
        name="q"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        {...props}
      />
    </div>
  );
}

"use client";

import { SORT_OPTIONS, type SortId } from "@/types/collection";
import styles from "./SortControl.module.css";

type SortControlProps = {
  value: SortId;
  onChange: (value: SortId) => void;
  id?: string;
};

export function SortControl({ value, onChange, id = "collection-sort" }: SortControlProps) {
  return (
    <div className={styles.wrap}>
      <label className={`text-micro ${styles.label}`} htmlFor={id}>
        Sort
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as SortId)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

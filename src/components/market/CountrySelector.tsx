"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SUPPORTED_COUNTRIES, supportedCountry } from "@/contracts/countries";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import styles from "./CountrySelector.module.css";

type CountrySelectorProps = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
  label?: string;
};

export function CountrySelector({
  value,
  onChange,
  disabled = false,
  showLabel = false,
  label = "Country",
}: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = supportedCountry(value) ?? supportedCountry(CHECKOUT_COUNTRY_GB);
  const countries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return SUPPORTED_COUNTRIES;
    }
    return SUPPORTED_COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) || country.code.toLowerCase().includes(needle),
    );
  }, [query]);

  useFocusTrap(open, rootRef, () => setOpen(false));

  useEffect(() => {
    if (!open) {
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(countries.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(countries.length - 1, 0));
    } else if (event.key === "Enter" && countries[active]) {
      event.preventDefault();
      choose(countries[active].code);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={styles.root} ref={rootRef} data-country-selector>
      {showLabel ? (
        <label className={`text-micro ${styles.label}`} id={labelId} htmlFor={`${listId}-button`}>
          {label}
        </label>
      ) : null}
      <button
        id={`${listId}-button`}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : `Country, ${selected?.name ?? "United Kingdom"}`}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const index = SUPPORTED_COUNTRIES.findIndex((country) => country.code === selected?.code);
          setQuery("");
          setActive(index >= 0 ? index : 0);
          setOpen(true);
        }}
      >
        {selected?.name ?? "United Kingdom"}
      </button>
      {open ? (
        <div className={styles.panel} onKeyDown={onKey}>
          <input
            ref={searchRef}
            className={styles.search}
            value={query}
            placeholder="Search countries"
            aria-label="Search countries"
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
          />
          <ul id={listId} className={styles.list} role="listbox" aria-label={label}>
            {countries.map((country, index) => {
              const isSelected = country.code === selected?.code;
              return (
                <li key={country.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={styles.row}
                    data-active={index === active || undefined}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(country.code)}
                  >
                    <span className={styles.mark} aria-hidden="true">
                      {isSelected ? (
                        <svg viewBox="0 0 16 16" width="16" height="16">
                          <path
                            d="M3 8.2 6.2 11.4 13 4.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span>{country.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

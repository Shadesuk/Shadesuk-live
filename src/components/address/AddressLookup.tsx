"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  ADDRESS_AUTOCOMPLETE_HINT,
  ADDRESS_AUTOCOMPLETE_LABEL,
  ADDRESS_AUTOCOMPLETE_PLACEHOLDER,
  ADDRESS_LOOKUP_EMPTY,
  ADDRESS_LOOKUP_EMPTY_INTL,
  ADDRESS_LOOKUP_ERROR,
  ADDRESS_LOOKUP_ERROR_INTL,
  ADDRESS_LOOKUP_LOADING,
  ADDRESS_LOOKUP_LOADING_INTL,
  ADDRESS_LOOKUP_UNAVAILABLE,
  ADDRESS_LOOKUP_UNAVAILABLE_INTL,
  ADDRESS_SEARCH_HINT,
  ADDRESS_SEARCH_LABEL,
  ADDRESS_SEARCH_PLACEHOLDER,
  ENTER_ADDRESS_MANUALLY,
  FIND_ADDRESS,
  POSTCODE_INVALID,
} from "@/lib/checkout-copy";
import { isUkPostcodeLookupQuery, normalizeCountry } from "@/lib/checkout-validate";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import type { AddressSuggestion, PostalAddress } from "@/types/integrations";
import type { AddressLookupView, AddressRetrieveView } from "@/types/checkout";
import styles from "./AddressLookup.module.css";

type LookupStatus = "idle" | "loading" | "empty" | "unavailable" | "error" | "invalid" | "selected";

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

type AddressLookupProps = {
  query: string;
  country?: string;
  onQueryChange: (query: string) => void;
  onSelect: (address: PostalAddress) => void;
  onManual: () => void;
  search: (query: string) => Promise<AddressLookupView>;
  retrieve: (id: string) => Promise<AddressRetrieveView>;
  disabled?: boolean;
  allowManual?: boolean;
};

export function AddressLookup({
  query,
  country = CHECKOUT_COUNTRY_GB,
  onQueryChange,
  onSelect,
  onManual,
  search,
  retrieve,
  disabled = false,
  allowManual = true,
}: AddressLookupProps) {
  const inputId = useId();
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [prevCountry, setPrevCountry] = useState(country);
  const requestRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const countryRef = useRef(country);
  const unitedKingdom = normalizeCountry(country) === CHECKOUT_COUNTRY_GB;

  if (country !== prevCountry) {
    setPrevCountry(country);
    setSuggestions([]);
    setActiveIndex(-1);
    setStatus("idle");
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (countryRef.current === country) {
      return;
    }
    countryRef.current = country;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    requestRef.current += 1;
  }, [country]);

  const showList = suggestions.length > 0 && (status === "idle" || status === "selected");
  const activeItem = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
  const activeId = activeItem ? `${listboxId}-${activeItem.id}` : undefined;
  const pending = status === "loading";

  function scheduleAutocomplete(next: string) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void runSearch(next);
    }, AUTOCOMPLETE_DEBOUNCE_MS);
  }

  async function runSearch(raw = query) {
    const next = raw.trim();
    if (unitedKingdom && !isUkPostcodeLookupQuery(next)) {
      setSuggestions([]);
      setActiveIndex(-1);
      setStatus("invalid");
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus("loading");
    setSuggestions([]);
    setActiveIndex(-1);
    let result: AddressLookupView;
    try {
      result = await search(next);
    } catch {
      if (requestId !== requestRef.current) {
        return;
      }
      setStatus("error");
      return;
    }
    if (requestId !== requestRef.current) {
      return;
    }
    if (result.status === "unavailable") {
      setStatus("unavailable");
      return;
    }
    if (result.status === "error") {
      setStatus("error");
      return;
    }
    if (result.suggestions.length === 0) {
      setStatus("empty");
      return;
    }
    if (unitedKingdom && result.suggestions.length === 1 && result.suggestions[0]) {
      await choose(result.suggestions[0], requestId);
      return;
    }
    setSuggestions(result.suggestions);
    setStatus("idle");
    setActiveIndex(0);
  }

  async function choose(suggestion: AddressSuggestion, requestId = requestRef.current) {
    setStatus("loading");
    let result: AddressRetrieveView;
    try {
      result = await retrieve(suggestion.id);
    } catch {
      if (requestId !== requestRef.current) {
        return;
      }
      setSuggestions([]);
      setStatus("error");
      return;
    }
    if (requestId !== requestRef.current) {
      return;
    }
    if (result.status !== "ok") {
      setSuggestions([]);
      setStatus(result.status === "unavailable" ? "unavailable" : "error");
      return;
    }
    onSelect(result.address);
    onQueryChange(unitedKingdom ? result.address.postcode : result.address.line1 || query);
    setSuggestions([]);
    setStatus("selected");
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (showList && activeItem) {
        void choose(activeItem);
        return;
      }
      if (!pending && !disabled) {
        void runSearch();
      }
      return;
    }
    if (!showList) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    }
  }

  return (
    <div className={styles.wrap} data-address-lookup data-lookup-status={status}>
      <div className={styles.find}>
        <Field
          id={inputId}
          label={unitedKingdom ? ADDRESS_SEARCH_LABEL : ADDRESS_AUTOCOMPLETE_LABEL}
          placeholder={unitedKingdom ? ADDRESS_SEARCH_PLACEHOLDER : ADDRESS_AUTOCOMPLETE_PLACEHOLDER}
          hint={unitedKingdom ? ADDRESS_SEARCH_HINT : ADDRESS_AUTOCOMPLETE_HINT}
          autoComplete={unitedKingdom ? "postal-code" : "street-address"}
          autoCapitalize={unitedKingdom ? "characters" : "off"}
          spellCheck={false}
          value={query}
          disabled={disabled || pending}
          error={status === "invalid" ? POSTCODE_INVALID : undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-activedescendant={activeId}
          onChange={(event) => {
            const next = event.target.value;
            onQueryChange(next);
            if (status === "invalid" || status === "empty" || status === "error" || status === "selected") {
              setStatus("idle");
            }
            if (!unitedKingdom && next.trim().length >= 3) {
              scheduleAutocomplete(next);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {unitedKingdom ? (
          <Button
            className={styles.findButton}
            type="button"
            variant="secondary"
            loading={pending}
            disabled={disabled}
            onClick={() => void runSearch()}
          >
            {FIND_ADDRESS}
          </Button>
        ) : null}
      </div>
      {status === "loading" ? (
        <p className="text-small" role="status">
          {unitedKingdom ? ADDRESS_LOOKUP_LOADING : ADDRESS_LOOKUP_LOADING_INTL}
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p className="text-small" role="status">
          {unitedKingdom ? ADDRESS_LOOKUP_UNAVAILABLE : ADDRESS_LOOKUP_UNAVAILABLE_INTL}
        </p>
      ) : null}
      {status === "empty" ? (
        <p className="text-small" role="status">
          {unitedKingdom ? ADDRESS_LOOKUP_EMPTY : ADDRESS_LOOKUP_EMPTY_INTL}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-small" role="status">
          {unitedKingdom ? ADDRESS_LOOKUP_ERROR : ADDRESS_LOOKUP_ERROR_INTL}
        </p>
      ) : null}
      {showList ? (
        <ul id={listboxId} className={styles.list} role="listbox">
          {suggestions.map((item) => {
            const optionId = `${listboxId}-${item.id}`;
            const selected = activeId === optionId;
            return (
              <li key={item.id} role="presentation">
                <button
                  id={optionId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? `${styles.option} ${styles.active}` : styles.option}
                  onClick={() => void choose(item)}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {allowManual ? (
        <>
          <p className={`text-small ${styles.or}`}>or</p>
          <Button variant="tertiary" type="button" onClick={onManual} disabled={disabled}>
            {ENTER_ADDRESS_MANUALLY}
          </Button>
        </>
      ) : null}
    </div>
  );
}

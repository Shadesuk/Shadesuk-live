"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  ADDRESS_LOOKUP_EMPTY,
  ADDRESS_LOOKUP_ERROR,
  ADDRESS_LOOKUP_LOADING,
  ADDRESS_LOOKUP_UNAVAILABLE,
  ADDRESS_SEARCH_HINT,
  ADDRESS_SEARCH_LABEL,
  ADDRESS_SEARCH_PLACEHOLDER,
  ENTER_ADDRESS_MANUALLY,
  FIND_ADDRESS,
  POSTCODE_INVALID,
} from "@/lib/checkout-copy";
import { isUkPostcodeLookupQuery } from "@/lib/checkout-validate";
import type { AddressSuggestion, PostalAddress } from "@/types/integrations";
import type { AddressLookupView, AddressRetrieveView } from "@/types/checkout";
import styles from "./AddressLookup.module.css";

type LookupStatus = "idle" | "loading" | "empty" | "unavailable" | "error" | "invalid" | "selected";

type AddressLookupProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (address: PostalAddress) => void;
  onManual: () => void;
  search: (query: string) => Promise<AddressLookupView>;
  retrieve: (id: string) => Promise<AddressRetrieveView>;
  disabled?: boolean;
};

export function AddressLookup({
  query,
  onQueryChange,
  onSelect,
  onManual,
  search,
  retrieve,
  disabled = false,
}: AddressLookupProps) {
  const inputId = useId();
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestRef = useRef(0);

  const showList = suggestions.length > 0 && (status === "idle" || status === "selected");
  const activeItem = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
  const activeId = activeItem ? `${listboxId}-${activeItem.id}` : undefined;
  const pending = status === "loading";

  async function runSearch() {
    const next = query.trim();
    if (!isUkPostcodeLookupQuery(next)) {
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
    const result = await search(next);
    if (requestId !== requestRef.current) {
      return;
    }
    if (result.status === "unavailable") {
      setStatus("unavailable");
      onManual();
      return;
    }
    if (result.status === "error") {
      setStatus("error");
      onManual();
      return;
    }
    if (result.suggestions.length === 0) {
      setStatus("empty");
      onManual();
      return;
    }
    if (result.suggestions.length === 1 && result.suggestions[0]) {
      await choose(result.suggestions[0], requestId);
      return;
    }
    setSuggestions(result.suggestions);
    setStatus("idle");
    setActiveIndex(0);
  }

  async function choose(suggestion: AddressSuggestion, requestId = requestRef.current) {
    setStatus("loading");
    const result = await retrieve(suggestion.id);
    if (requestId !== requestRef.current) {
      return;
    }
    if (result.status !== "ok") {
      setSuggestions([]);
      setStatus(result.status === "unavailable" ? "unavailable" : "error");
      onManual();
      return;
    }
    onSelect(result.address);
    onQueryChange(result.address.postcode);
    setSuggestions([]);
    setStatus("selected");
    setActiveIndex(-1);
    onManual();
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
          label={ADDRESS_SEARCH_LABEL}
          placeholder={ADDRESS_SEARCH_PLACEHOLDER}
          hint={ADDRESS_SEARCH_HINT}
          autoComplete="postal-code"
          autoCapitalize="characters"
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
            onQueryChange(event.target.value);
            if (status === "invalid" || status === "empty" || status === "error" || status === "selected") {
              setStatus("idle");
            }
          }}
          onKeyDown={handleKeyDown}
        />
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
      </div>
      {status === "loading" ? (
        <p className="text-small" role="status">
          {ADDRESS_LOOKUP_LOADING}
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p className="text-small" role="status">
          {ADDRESS_LOOKUP_UNAVAILABLE}
        </p>
      ) : null}
      {status === "empty" ? (
        <p className="text-small" role="status">
          {ADDRESS_LOOKUP_EMPTY}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-small" role="status">
          {ADDRESS_LOOKUP_ERROR}
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
      <p className={`text-small ${styles.or}`}>or</p>
      <Button variant="tertiary" type="button" onClick={onManual} disabled={disabled}>
        {ENTER_ADDRESS_MANUALLY}
      </Button>
    </div>
  );
}

"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  ADDRESS_LOOKUP_EMPTY,
  ADDRESS_LOOKUP_ERROR,
  ADDRESS_LOOKUP_LOADING,
  ADDRESS_LOOKUP_UNAVAILABLE,
  ADDRESS_SEARCH_LABEL,
  ADDRESS_SEARCH_PLACEHOLDER,
  ENTER_ADDRESS_MANUALLY,
} from "@/lib/checkout-copy";
import type { AddressSuggestion, PostalAddress } from "@/types/integrations";
import type { AddressLookupView, AddressRetrieveView } from "@/types/checkout";
import styles from "./AddressLookup.module.css";

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
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "unavailable" | "error">(
    "idle",
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const showList = suggestions.length > 0 && status === "idle";
  const activeItem = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
  const activeId = activeItem ? `${listboxId}-${activeItem.id}` : undefined;

  function queueSearch(next: string) {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (next.trim().length < 3) {
      setSuggestions([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }
    setStatus("loading");
    debounceRef.current = window.setTimeout(() => {
      void runSearch(next);
    }, 280);
  }

  async function runSearch(next: string) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const result = await search(next);
    if (requestId !== requestRef.current) {
      return;
    }
    if (result.status === "unavailable") {
      setSuggestions([]);
      setStatus("unavailable");
      return;
    }
    if (result.status === "error") {
      setSuggestions([]);
      setStatus("error");
      return;
    }
    setSuggestions(result.suggestions);
    setStatus(result.suggestions.length === 0 ? "empty" : "idle");
    setActiveIndex(-1);
  }

  async function choose(suggestion: AddressSuggestion) {
    const result = await retrieve(suggestion.id);
    if (result.status !== "ok") {
      setStatus(result.status === "unavailable" ? "unavailable" : "error");
      onManual();
      return;
    }
    onSelect(result.address);
    setSuggestions([]);
    setStatus("idle");
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
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
    if (event.key === "Enter" && activeItem) {
      event.preventDefault();
      void choose(activeItem);
    }
  }

  return (
    <div className={styles.wrap} data-address-lookup>
      <Field
        id={inputId}
        label={ADDRESS_SEARCH_LABEL}
        placeholder={ADDRESS_SEARCH_PLACEHOLDER}
        autoComplete="off"
        value={query}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={showList}
        aria-controls={showList ? listboxId : undefined}
        aria-activedescendant={activeId}
        onChange={(event) => {
          const next = event.target.value;
          onQueryChange(next);
          queueSearch(next);
        }}
        onKeyDown={handleKeyDown}
      />
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

"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  clearRecentSearches,
  getRecentSearches,
  recordRecentSearch,
  removeRecentSearch,
  subscribeRecentSearches,
} from "@/lib/recent-searches";
import {
  getSearchSuggestions,
  searchPath,
  type SearchDiscoveryLink,
  type SearchSuggestion,
} from "@/services/search";
import { DiscoverySuggestions, RecentSearches } from "./RecentSearches";
import { SearchInput } from "./SearchInput";
import { SearchSuggestions } from "./SearchSuggestions";
import styles from "./SearchForm.module.css";

const EMPTY_RECENT: string[] = [];

type SearchFormProps = {
  initialQuery?: string;
  autoFocus?: boolean;
  discovery?: SearchDiscoveryLink[];
  variant?: "overlay" | "page";
  titleId?: string;
  onDismiss?: () => void;
};

export function SearchForm({
  initialQuery = "",
  autoFocus = false,
  discovery = [],
  variant = "page",
  titleId,
  onDismiss,
}: SearchFormProps) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const [value, setValue] = useState(initialQuery);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<number | null>(null);
  const recents = useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearches,
    () => EMPTY_RECENT,
  );

  const suggestions = useMemo(
    () => getSearchSuggestions(suggestQuery),
    [suggestQuery],
  );
  const showSuggestions = suggestQuery.trim().length > 0 && suggestions.length > 0;
  const activeItem = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
  const activeId = activeItem ? `${listboxId}-${activeItem.id}` : undefined;

  function queueSuggestions(next: string) {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setSuggestQuery(next);
      setActiveIndex(-1);
    }, 200);
  }

  function goToResults(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    recordRecentSearch(trimmed);
    onDismiss?.();
    router.push(searchPath(trimmed));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goToResults(value);
  }

  function handleSelect(item: SearchSuggestion) {
    if (item.kind !== "product") {
      recordRecentSearch(item.label);
    } else if (value.trim()) {
      recordRecentSearch(value);
    }
    onDismiss?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (showSuggestions) {
        event.preventDefault();
        setSuggestQuery("");
        setActiveIndex(-1);
        return;
      }
      onDismiss?.();
      return;
    }
    if (!showSuggestions) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    }
    if (event.key === "Enter" && activeItem) {
      event.preventDefault();
      handleSelect(activeItem);
      router.push(activeItem.href);
    }
  }

  return (
    <div className={styles.wrap}>
      {variant === "overlay" && titleId ? (
        <h2 id={titleId} className="text-h3">
          Search
        </h2>
      ) : null}
      <form className={styles.form} role="search" onSubmit={handleSubmit}>
        <SearchInput
          id={inputId}
          value={value}
          autoFocus={autoFocus}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={activeId}
          placeholder="Search products, brands, colours, shapes"
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            queueSuggestions(next);
          }}
          onKeyDown={handleKeyDown}
        />
        <Button type="submit" disabled={!value.trim()}>
          Search
        </Button>
      </form>
      {onDismiss ? (
        <Button className={styles.close} variant="tertiary" onClick={onDismiss}>
          Close
        </Button>
      ) : null}
      {showSuggestions ? (
        <div className={styles.panel}>
          <SearchSuggestions
            id={listboxId}
            items={suggestions}
            activeId={activeId}
            onSelect={handleSelect}
          />
          <Link
            className={styles.viewAll}
            href={searchPath(value)}
            onClick={() => {
              if (!value.trim()) {
                return;
              }
              recordRecentSearch(value);
              onDismiss?.();
            }}
          >
            View all results
          </Link>
        </div>
      ) : (
        <>
          <RecentSearches
            items={recents}
            onChoose={(query) => {
              recordRecentSearch(query);
              onDismiss?.();
            }}
            onRemove={removeRecentSearch}
            onClear={clearRecentSearches}
          />
          <DiscoverySuggestions items={discovery} />
        </>
      )}
    </div>
  );
}

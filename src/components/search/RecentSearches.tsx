"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { searchPath, type SearchDiscoveryLink } from "@/services/search";
import styles from "./RecentSearches.module.css";

type RecentSearchesProps = {
  items: string[];
  onChoose: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
};

export function RecentSearches({
  items,
  onChoose,
  onRemove,
  onClear,
}: RecentSearchesProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="Recent searches">
      <div className={styles.heading}>
        <h3 className="text-micro">Recent searches</h3>
        <Button variant="tertiary" onClick={onClear}>
          Clear all
        </Button>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item} className={styles.row}>
            <Link
              href={searchPath(item)}
              className={styles.query}
              onClick={() => onChoose(item)}
            >
              {item}
            </Link>
            <Button
              variant="tertiary"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type DiscoverySuggestionsProps = {
  items: SearchDiscoveryLink[];
};

export function DiscoverySuggestions({ items }: DiscoverySuggestionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label="Suggested searches">
      <h3 className="text-micro">Browse</h3>
      <ul className={styles.chips}>
        {items.map((item) => (
          <li key={item.id}>
            <Link className={styles.chip} href={item.href}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

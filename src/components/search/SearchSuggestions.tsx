import Link from "next/link";
import type { SearchSuggestion } from "@/lib/search-query";
import styles from "./SearchSuggestions.module.css";

type SearchSuggestionsProps = {
  id: string;
  items: SearchSuggestion[];
  activeId?: string;
  onSelect: (item: SearchSuggestion) => void;
};

export function SearchSuggestions({
  id,
  items,
  activeId,
  onSelect,
}: SearchSuggestionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul id={id} className={styles.list} role="listbox">
      {items.map((item) => {
        const optionId = `${id}-${item.id}`;
        const selected = activeId === optionId;
        return (
          <li key={item.id} role="presentation">
            <Link
              id={optionId}
              href={item.href}
              role="option"
              aria-selected={selected}
              className={selected ? `${styles.option} ${styles.active}` : styles.option}
              onClick={() => onSelect(item)}
            >
              <span>{item.label}</span>
              {item.meta ? <span className={styles.meta}>{item.meta}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

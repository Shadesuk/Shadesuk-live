"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UtilityButton } from "@/components/navigation/UtilityButton";
import {
  collectionQueryPath,
  countActiveFilters,
  emptyCollectionQuery,
  getFilterChips,
  hiddenFilterKeys,
  removeFilterChip,
} from "@/services/collections";
import type { CatalogueFilters } from "@/types/catalogue";
import {
  COLLECTION_PAGE_SIZE,
  type CollectionDefinition,
  type CollectionQuery,
  type SortId,
} from "@/types/collection";
import { FilterChip } from "./FilterChip";
import { FilterDrawer } from "./FilterDrawer";
import { SortControl } from "./SortControl";
import styles from "./FilterBar.module.css";

type FilterBarProps = {
  collection: CollectionDefinition;
  query: CollectionQuery;
  options: CatalogueFilters;
};

export function FilterBar({ collection, query, options }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const hidden = hiddenFilterKeys(collection);
  const chips = getFilterChips(query, collection, options);
  const activeCount = countActiveFilters(query, collection, options);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    function update() {
      setDesktop(media.matches);
    }
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function pushQuery(next: CollectionQuery) {
    router.push(collectionQueryPath(pathname, next, { resetLimit: true }), {
      scroll: false,
    });
  }

  function handleSort(sort: SortId) {
    pushQuery({ ...query, sort, limit: COLLECTION_PAGE_SIZE });
  }

  function handleApply(next: CollectionQuery) {
    pushQuery({ ...next, limit: COLLECTION_PAGE_SIZE });
  }

  function handleChip(key: string) {
    pushQuery(removeFilterChip(query, key));
  }

  function handleClearAll() {
    pushQuery({
      ...emptyCollectionQuery(),
      sort: query.sort,
    });
  }

  return (
    <div className={styles.bar}>
      <div className={styles.controls}>
        <UtilityButton
          onClick={() => setOpen(true)}
          expanded={open}
          controls="collection-filters"
          hasPopup="dialog"
          count={activeCount}
        >
          Filter
        </UtilityButton>
        <SortControl value={query.sort} onChange={handleSort} />
      </div>
      {chips.length > 0 ? (
        <div className={styles.chips}>
          {chips.map((chip) => (
            <span key={chip.key} className={styles.chip}>
              <FilterChip label={chip.label} onRemove={() => handleChip(chip.key)} />
            </span>
          ))}
          <button type="button" className={styles.clear} onClick={handleClearAll}>
            Clear all
          </button>
        </div>
      ) : null}
      <FilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        value={query}
        options={options}
        hidden={hidden}
        onApply={handleApply}
        side={desktop ? "right" : "bottom"}
      />
    </div>
  );
}

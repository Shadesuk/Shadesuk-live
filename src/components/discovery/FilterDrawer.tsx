"use client";

import { useEffect, useId, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { useChrome } from "@/components/navigation/ChromeContext";
import { Button } from "@/components/ui/Button";
import type { CatalogueFilters } from "@/types/catalogue";
import type { CollectionQuery, HiddenFilterKey } from "@/types/collection";
import { FilterForm, FilterFormActions } from "./FilterForm";
import styles from "./FilterDrawer.module.css";

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  value: CollectionQuery;
  options: CatalogueFilters;
  hidden: HiddenFilterKey[];
  onApply: (next: CollectionQuery) => void;
  side: "bottom" | "right";
};

export function FilterDrawer({
  open,
  onClose,
  value,
  options,
  hidden,
  onApply,
  side,
}: FilterDrawerProps) {
  const { acquirePageLock, releasePageLock } = useChrome();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    acquirePageLock();
    return () => releasePageLock();
  }, [open, acquirePageLock, releasePageLock]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      titleId={titleId}
      side={side}
      id="collection-filters"
    >
      {open ? (
        <FilterDraft
          titleId={titleId}
          value={value}
          options={options}
          hidden={hidden}
          onApply={(next) => {
            onApply(next);
            onClose();
          }}
          onClose={onClose}
        />
      ) : null}
    </Drawer>
  );
}

function FilterDraft({
  titleId,
  value,
  options,
  hidden,
  onApply,
  onClose,
}: {
  titleId: string;
  value: CollectionQuery;
  options: CatalogueFilters;
  hidden: HiddenFilterKey[];
  onApply: (next: CollectionQuery) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);

  function handleClear() {
    setDraft({
      ...draft,
      genders: [],
      brands: [],
      shapes: [],
      colours: [],
      price: undefined,
      inStockOnly: false,
    });
  }

  return (
    <div className={styles.sheet}>
      <div className={styles.toolbar}>
        <h2 id={titleId} className="text-h3">
          Filter
        </h2>
        <Button variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className={styles.body}>
        <FilterForm
          value={draft}
          options={options}
          hidden={hidden}
          onChange={setDraft}
        />
      </div>
      <div className={styles.footer}>
        <FilterFormActions onClear={handleClear} onApply={() => onApply(draft)} />
      </div>
    </div>
  );
}

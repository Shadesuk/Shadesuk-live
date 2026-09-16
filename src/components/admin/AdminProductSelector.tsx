"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import type { AdminMerchandisingProductRef } from "@/contracts/admin/merchandising";
import { searchMerchandisingProductsAction } from "@/app/admin/merchandising/actions";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  ADMIN_MERCHANDISING_ERROR,
  ADMIN_MERCHANDISING_RETRY,
  ADMIN_MERCHANDISING_SEARCH_EMPTY,
  ADMIN_MERCHANDISING_SEARCH_HINT,
  ADMIN_MERCHANDISING_SEARCH_LABEL,
  ADMIN_PRODUCT_CANCEL,
} from "@/lib/admin-copy";
import styles from "./AdminMerchandising.module.css";

export function AdminProductSelector({
  open,
  single,
  excludeIds,
  onSelect,
  onClose,
}: {
  open: boolean;
  single: boolean;
  excludeIds: string[];
  onSelect: (product: AdminMerchandisingProductRef) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<AdminMerchandisingProductRef[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      setStatus("loading");
      void searchMerchandisingProductsAction(q, excludeIds).then((result) => {
        if (!active) {
          return;
        }
        if (result.status === "ok") {
          setProducts(result.products);
          setStatus("ok");
          return;
        }
        setProducts([]);
        setStatus("error");
      });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [open, q, excludeIds]);

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} descriptionId={descriptionId}>
      <h2 id={titleId} className="text-h3">
        {ADMIN_MERCHANDISING_SEARCH_LABEL}
      </h2>
      <p id={descriptionId} className="text-small">
        {single ? "Select one published product." : ADMIN_MERCHANDISING_SEARCH_HINT}
      </p>
      <Field
        id="merch-product-search"
        label={ADMIN_MERCHANDISING_SEARCH_LABEL}
        value={q}
        onChange={(event) => setQ(event.target.value)}
        autoComplete="off"
      />
      {status === "loading" ? (
        <p className="text-small" role="status">
          Searching
        </p>
      ) : null}
      {status === "error" ? (
        <div role="alert">
          <p className="text-small">{ADMIN_MERCHANDISING_ERROR}</p>
          <Button type="button" variant="secondary" onClick={() => setQ((current) => `${current}`.trim())}>
            {ADMIN_MERCHANDISING_RETRY}
          </Button>
        </div>
      ) : null}
      {status === "ok" && products.length === 0 ? (
        <p className="text-small" role="status">
          {ADMIN_MERCHANDISING_SEARCH_EMPTY}
        </p>
      ) : null}
      {products.length > 0 ? (
        <ul className={styles.results}>
          {products.map((product) => (
            <li key={product.id}>
              <button type="button" className={styles.result} onClick={() => onSelect(product)}>
                {product.imageSrc && product.imageWidth && product.imageHeight ? (
                  <Image
                    src={product.imageSrc}
                    alt=""
                    width={product.imageWidth}
                    height={product.imageHeight}
                    className={styles.thumb}
                    sizes="3.5rem"
                  />
                ) : (
                  <span className={styles.thumbEmpty} aria-hidden="true" />
                )}
                <span>
                  <span className={styles.name}>{product.name}</span>
                  {product.brand ? <span className="text-small">{product.brand}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="secondary" onClick={onClose}>
        {ADMIN_PRODUCT_CANCEL}
      </Button>
    </Modal>
  );
}

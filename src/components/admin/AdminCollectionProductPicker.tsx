"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import type { AdminCollectionProductRef } from "@/contracts/admin/collections";
import { searchCollectionProductsAction } from "@/app/admin/collections/actions";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  ADMIN_COLLECTION_ADD_PRODUCT,
  ADMIN_COLLECTION_CANCEL,
  ADMIN_COLLECTION_SEARCH_EMPTY,
  ADMIN_COLLECTION_SEARCH_ERROR,
  ADMIN_COLLECTION_SEARCH_PRODUCTS,
  ADMIN_COLLECTION_SEARCH_PRODUCTS_HINT,
  ADMIN_COLLECTIONS_RETRY,
} from "@/lib/admin-copy";
import { ADMIN_CATALOGUE_STATUS_LABELS } from "@/contracts/admin/products";
import styles from "./AdminCollections.module.css";

export function AdminCollectionProductPicker({
  open,
  excludeIds,
  onSelect,
  onClose,
}: {
  open: boolean;
  excludeIds: string[];
  onSelect: (product: AdminCollectionProductRef) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [q, setQ] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [products, setProducts] = useState<AdminCollectionProductRef[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      setStatus("loading");
      void searchCollectionProductsAction(q, excludeIds).then((result) => {
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
  }, [open, q, excludeIds, retryKey]);

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} descriptionId={descriptionId}>
      <h2 id={titleId} className="text-h3">
        {ADMIN_COLLECTION_ADD_PRODUCT}
      </h2>
      <p id={descriptionId} className="text-small">
        {ADMIN_COLLECTION_SEARCH_PRODUCTS_HINT}
      </p>
      <Field
        id="collection-product-search"
        label={ADMIN_COLLECTION_SEARCH_PRODUCTS}
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
          <p className="text-small">{ADMIN_COLLECTION_SEARCH_ERROR}</p>
          <Button type="button" variant="secondary" onClick={() => setRetryKey((current) => current + 1)}>
            {ADMIN_COLLECTIONS_RETRY}
          </Button>
        </div>
      ) : null}
      {status === "ok" && products.length === 0 ? (
        <p className="text-small" role="status">
          {ADMIN_COLLECTION_SEARCH_EMPTY}
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
                  <span className="text-small">
                    {[product.brand, product.sku, ADMIN_CATALOGUE_STATUS_LABELS[product.status]]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="secondary" onClick={onClose}>
        {ADMIN_COLLECTION_CANCEL}
      </Button>
    </Modal>
  );
}

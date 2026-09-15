"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cartIssueMessage } from "@/lib/cart-copy";
import { formatGbp } from "@/lib/money";
import { ADD_TO_BAG_QUANTITY_MAX } from "@/lib/add-to-bag";
import type { PublicCartItem } from "@/types/cart";
import styles from "./CartLine.module.css";

type CartLineProps = {
  item: PublicCartItem;
  pending?: boolean;
  onQuantity: (itemId: string, quantity: number) => Promise<boolean> | boolean;
  onRemove: (itemId: string) => Promise<boolean> | boolean;
  onNavigate?: () => void;
};

export function CartLine({
  item,
  pending = false,
  onQuantity,
  onRemove,
  onNavigate,
}: CartLineProps) {
  const [busy, setBusy] = useState(false);
  const disabled = pending || busy;
  const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");

  async function changeQuantity(next: number) {
    if (disabled) {
      return;
    }
    setBusy(true);
    await onQuantity(item.id, next);
    setBusy(false);
  }

  async function remove() {
    if (disabled) {
      return;
    }
    setBusy(true);
    await onRemove(item.id);
    setBusy(false);
  }

  return (
    <article className={styles.line} data-cart-line={item.slug}>
      <div className={styles.media}>
        {item.image?.src ? (
          <Image
            src={item.image.src}
            alt={item.image.alt}
            width={item.image.width}
            height={item.image.height}
            className={styles.image}
          />
        ) : (
          <span className={`${styles.fallback} text-micro`}>Product image</span>
        )}
      </div>
      <div className={styles.body}>
        <p className="text-small">
          <Link className={styles.name} href={item.href} onClick={onNavigate}>
            {item.name}
          </Link>
        </p>
        {variant ? <p className={`text-micro ${styles.meta}`}>{variant}</p> : null}
        <div className={styles.row}>
          <div className={styles.quantity}>
            <button
              type="button"
              aria-label={`Decrease quantity of ${item.name}`}
              disabled={disabled || item.quantity <= 1}
              onClick={() => void changeQuantity(item.quantity - 1)}
            >
              −
            </button>
            <span aria-live="polite">{item.quantity}</span>
            <button
              type="button"
              aria-label={`Increase quantity of ${item.name}`}
              disabled={disabled || item.quantity >= ADD_TO_BAG_QUANTITY_MAX}
              onClick={() => void changeQuantity(item.quantity + 1)}
            >
              +
            </button>
          </div>
          <p className={`text-small ${styles.price}`}>{formatGbp(item.lineTotal)}</p>
        </div>
        <Button variant="tertiary" onClick={() => void remove()} disabled={disabled}>
          Remove
        </Button>
        {item.issue ? (
          <p className={`text-micro ${styles.issue}`} role="status">
            {cartIssueMessage(item.issue)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

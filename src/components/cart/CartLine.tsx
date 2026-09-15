"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductThumb } from "@/components/product/ProductThumb";
import { Button } from "@/components/ui/Button";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { cartIssueMessage } from "@/lib/cart-copy";
import { formatGbp } from "@/lib/money";
import { ADD_TO_BAG_QUANTITY_MAX } from "@/lib/add-to-bag";
import type { PublicCartItem } from "@/types/cart";
import styles from "./CartLine.module.css";

type CartLineProps = {
  item: PublicCartItem;
  pending?: boolean;
  compact?: boolean;
  onQuantity: (itemId: string, quantity: number) => Promise<boolean> | boolean;
  onRemove: (itemId: string) => Promise<boolean> | boolean;
  onNavigate?: () => void;
};

export function CartLine({
  item,
  pending = false,
  compact = false,
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
    <article className={styles.line} data-cart-line={item.slug} data-compact={compact || undefined}>
      <Link
        className={styles.mediaLink}
        href={item.href}
        onClick={onNavigate}
        aria-label={`View ${item.name}`}
      >
        <ProductThumb image={item.image} compact={compact} />
      </Link>
      <div className={styles.body}>
        <div className={styles.copy}>
          <p className="text-small">
            <Link className={styles.name} href={item.href} onClick={onNavigate}>
              {item.name}
            </Link>
          </p>
          {variant ? <p className={`text-micro ${styles.meta}`}>{variant}</p> : null}
        </div>
        <div className={styles.row}>
          <QuantityControl
            value={item.quantity}
            min={1}
            max={ADD_TO_BAG_QUANTITY_MAX}
            disabled={disabled}
            decreaseLabel={`Decrease quantity of ${item.name}`}
            increaseLabel={`Increase quantity of ${item.name}`}
            onChange={(next) => void changeQuantity(next)}
          />
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

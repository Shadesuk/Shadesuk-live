"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import type { AdminMerchandisingProductRef, AdminMerchandisingView } from "@/contracts/admin/merchandising";
import {
  saveAdminMerchandisingAction,
  type AdminMerchandisingActionState,
} from "@/app/admin/merchandising/actions";
import { Button } from "@/components/ui/Button";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminProductSelector } from "./AdminProductSelector";
import {
  ADMIN_MERCHANDISING_ADD_PRODUCT,
  ADMIN_MERCHANDISING_BEST_SELLERS,
  ADMIN_MERCHANDISING_BEST_SELLERS_EMPTY,
  ADMIN_MERCHANDISING_BODY,
  ADMIN_MERCHANDISING_CHANGE_PRODUCT,
  ADMIN_MERCHANDISING_DISABLED,
  ADMIN_MERCHANDISING_ENABLED,
  ADMIN_MERCHANDISING_FEATURED,
  ADMIN_MERCHANDISING_FEATURED_EMPTY,
  ADMIN_MERCHANDISING_FLAGSHIP,
  ADMIN_MERCHANDISING_FLAGSHIP_EMPTY,
  ADMIN_MERCHANDISING_HEADING,
  ADMIN_MERCHANDISING_HOMEPAGE,
  ADMIN_MERCHANDISING_MOVE_DOWN,
  ADMIN_MERCHANDISING_MOVE_UP,
  ADMIN_MERCHANDISING_NEW_ARRIVALS,
  ADMIN_MERCHANDISING_NEW_ARRIVALS_BODY,
  ADMIN_MERCHANDISING_NEW_ARRIVALS_EMPTY,
  ADMIN_MERCHANDISING_REMOVE,
  ADMIN_MERCHANDISING_RETRY,
  ADMIN_MERCHANDISING_SAVE,
  ADMIN_MERCHANDISING_SAVE_FAILED_BODY,
  ADMIN_MERCHANDISING_SAVE_FAILED_TITLE,
  ADMIN_MERCHANDISING_SAVED,
  ADMIN_MERCHANDISING_SAVING,
  ADMIN_MERCHANDISING_SELECT_PRODUCT,
  ADMIN_MERCHANDISING_SELECTED,
} from "@/lib/admin-copy";
import styles from "./AdminMerchandising.module.css";

const idle: AdminMerchandisingActionState = { status: "idle" };

export function AdminMerchandisingEditor({ initial }: { initial: AdminMerchandisingView }) {
  const [featuredEnabled, setFeaturedEnabled] = useState(initial.featuredEnabled);
  const [bestSellersEnabled, setBestSellersEnabled] = useState(initial.bestSellersEnabled);
  const [featured, setFeatured] = useState(initial.featured);
  const [bestSellers, setBestSellers] = useState(initial.bestSellers);
  const [flagship, setFlagship] = useState(initial.flagship);
  const [picker, setPicker] = useState<"featured" | "bestSellers" | "flagship" | null>(null);
  const [state, action, pending] = useActionState(saveAdminMerchandisingAction, idle);

  const exclude = useMemo(() => {
    if (picker === "featured") {
      return featured.map((item) => item.id);
    }
    if (picker === "bestSellers") {
      return bestSellers.map((item) => item.id);
    }
    return [];
  }, [picker, featured, bestSellers]);

  const saveFailed = state.status === "error" || state.status === "forbidden" || state.status === "invalid";

  return (
    <div data-admin-merchandising>
      <AdminPageHeader title={ADMIN_MERCHANDISING_HEADING} description={ADMIN_MERCHANDISING_BODY} />
      <form className={styles.page} action={action} noValidate>
        {featured.map((product) => (
          <input key={`featured-${product.id}`} type="hidden" name="featuredId" value={product.id} />
        ))}
        {bestSellers.map((product) => (
          <input key={`best-${product.id}`} type="hidden" name="bestSellerId" value={product.id} />
        ))}
        {flagship ? <input type="hidden" name="flagshipId" value={flagship.id} /> : null}

        <section className={styles.section} aria-labelledby="merch-home-heading">
          <h2 id="merch-home-heading" className={styles.sectionTitle}>
            {ADMIN_MERCHANDISING_HOMEPAGE}
          </h2>
        </section>

        <MerchList
          id="featured"
          title={ADMIN_MERCHANDISING_FEATURED}
          enabled={featuredEnabled}
          onEnabledChange={setFeaturedEnabled}
          enabledName="featuredEnabled"
          products={featured}
          empty={ADMIN_MERCHANDISING_FEATURED_EMPTY}
          onMove={(index, direction) => setFeatured((current) => moveItem(current, index, direction))}
          onRemove={(id) => setFeatured((current) => current.filter((item) => item.id !== id))}
          onAdd={() => setPicker("featured")}
          addLabel={ADMIN_MERCHANDISING_ADD_PRODUCT}
        />

        <section className={styles.section} aria-labelledby="new-arrivals-heading">
          <h2 id="new-arrivals-heading" className={styles.sectionTitle}>
            {ADMIN_MERCHANDISING_NEW_ARRIVALS}
          </h2>
          <p className={`text-small ${styles.quiet}`}>{ADMIN_MERCHANDISING_NEW_ARRIVALS_BODY}</p>
          {initial.newArrivals.length === 0 ? (
            <p className={`text-small ${styles.quiet}`}>{ADMIN_MERCHANDISING_NEW_ARRIVALS_EMPTY}</p>
          ) : (
            <ol className={styles.list}>
              {initial.newArrivals.map((product) => (
                <li key={product.id} className={styles.row}>
                  <ProductThumb product={product} />
                  <p className={styles.name}>{product.name}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <MerchList
          id="best-sellers"
          title={ADMIN_MERCHANDISING_BEST_SELLERS}
          enabled={bestSellersEnabled}
          onEnabledChange={setBestSellersEnabled}
          enabledName="bestSellersEnabled"
          products={bestSellers}
          empty={ADMIN_MERCHANDISING_BEST_SELLERS_EMPTY}
          onMove={(index, direction) => setBestSellers((current) => moveItem(current, index, direction))}
          onRemove={(id) => setBestSellers((current) => current.filter((item) => item.id !== id))}
          onAdd={() => setPicker("bestSellers")}
          addLabel={ADMIN_MERCHANDISING_ADD_PRODUCT}
        />

        <section className={styles.section} aria-labelledby="flagship-heading">
          <h2 id="flagship-heading" className={styles.sectionTitle}>
            {ADMIN_MERCHANDISING_FLAGSHIP}
          </h2>
          {flagship ? (
            <div className={styles.flagship}>
              <p className={`text-micro ${styles.quiet}`}>{ADMIN_MERCHANDISING_SELECTED}</p>
              <div className={styles.row}>
                <ProductThumb product={flagship} />
                <p className={styles.name}>{flagship.name}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setPicker("flagship")}>
                {ADMIN_MERCHANDISING_CHANGE_PRODUCT}
              </Button>
            </div>
          ) : (
            <div className={styles.empty}>
              <p className="text-small">{ADMIN_MERCHANDISING_FLAGSHIP_EMPTY}</p>
              <Button type="button" variant="secondary" onClick={() => setPicker("flagship")}>
                {ADMIN_MERCHANDISING_SELECT_PRODUCT}
              </Button>
            </div>
          )}
        </section>

        {pending ? (
          <p className={`text-small ${styles.banner}`} role="status">
            {ADMIN_MERCHANDISING_SAVING}…
          </p>
        ) : null}
        {state.status === "ok" && !pending ? (
          <p className={`text-small ${styles.banner}`} role="status">
            {ADMIN_MERCHANDISING_SAVED} ✓
          </p>
        ) : null}
        {saveFailed && !pending ? (
          <div role="alert">
            <p className={`text-micro ${styles.banner}`}>{ADMIN_MERCHANDISING_SAVE_FAILED_TITLE}</p>
            <p className={`text-small ${styles.banner}`}>{state.message || ADMIN_MERCHANDISING_SAVE_FAILED_BODY}</p>
          </div>
        ) : null}
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? ADMIN_MERCHANDISING_SAVING : saveFailed ? ADMIN_MERCHANDISING_RETRY : ADMIN_MERCHANDISING_SAVE}
        </Button>
      </form>
      {picker ? (
        <AdminProductSelector
          open
          single={picker === "flagship"}
          excludeIds={exclude}
          onClose={() => setPicker(null)}
          onSelect={(product) => {
            if (picker === "featured") {
              setFeatured((current) => current.some((item) => item.id === product.id) ? current : [...current, product]);
            } else if (picker === "bestSellers") {
              setBestSellers((current) =>
                current.some((item) => item.id === product.id) ? current : [...current, product],
              );
            } else {
              setFlagship(product);
            }
            setPicker(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MerchList({
  id,
  title,
  enabled,
  onEnabledChange,
  enabledName,
  products,
  empty,
  onMove,
  onRemove,
  onAdd,
  addLabel,
}: {
  id: string;
  title: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  enabledName: string;
  products: AdminMerchandisingProductRef[];
  empty: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.header}>
        <h2 id={`${id}-heading`} className={styles.sectionTitle}>
          {title}
        </h2>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            name={enabledName}
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          {enabled ? ADMIN_MERCHANDISING_ENABLED : ADMIN_MERCHANDISING_DISABLED}
        </label>
      </div>
      {products.length === 0 ? (
        <div className={styles.empty}>
          <p className="text-small">{empty}</p>
          <Button type="button" variant="secondary" onClick={onAdd}>
            {addLabel}
          </Button>
        </div>
      ) : (
        <>
          <ol className={styles.list}>
            {products.map((product, index) => (
              <li key={product.id} className={styles.row}>
                <span className={styles.index}>{index + 1}</span>
                <ProductThumb product={product} />
                <p className={styles.name}>{product.name}</p>
                <div className={styles.rowActions}>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={index === 0}
                    onClick={() => onMove(index, -1)}
                  >
                    {ADMIN_MERCHANDISING_MOVE_UP}
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    disabled={index === products.length - 1}
                    onClick={() => onMove(index, 1)}
                  >
                    {ADMIN_MERCHANDISING_MOVE_DOWN}
                  </Button>
                  <Button type="button" variant="tertiary" onClick={() => onRemove(product.id)}>
                    {ADMIN_MERCHANDISING_REMOVE}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" onClick={onAdd}>
            {addLabel}
          </Button>
        </>
      )}
    </section>
  );
}

function ProductThumb({ product }: { product: AdminMerchandisingProductRef }) {
  if (product.imageSrc && product.imageWidth && product.imageHeight) {
    return (
      <Image
        src={product.imageSrc}
        alt={product.imageAlt}
        width={product.imageWidth}
        height={product.imageHeight}
        className={styles.thumb}
        sizes="3.5rem"
      />
    );
  }
  return <span className={styles.thumbEmpty} aria-hidden="true" />;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const current = next[index];
  const swap = next[nextIndex];
  if (!current || !swap) {
    return items;
  }
  next[index] = swap;
  next[nextIndex] = current;
  return next;
}

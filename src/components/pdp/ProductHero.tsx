"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MappedStorefrontProduct } from "@/contracts";
import { Button } from "@/components/ui/Button";
import { formatGbp } from "@/lib/money";
import { cx } from "@/lib/cx";
import {
  getAvailabilityLabel,
  getColourCount,
  isProductAvailable,
} from "@/lib/product-display";
import { ADD_TO_BAG_QUANTITY_MAX, resolveSelectedVariant } from "@/lib/add-to-bag";
import { addToBagAction } from "@/app/product/actions";
import { useCart } from "@/components/cart/CartProvider";
import { track } from "@/lib/analytics";
import type { PublicAddToBagResult } from "@/types/pdp";
import { ProductContent } from "./ProductContent";
import { ProductGallery } from "./ProductGallery";
import { SizeFaceGuide } from "./SizeFaceGuide";
import styles from "./ProductPage.module.css";

type ProductHeroProps = {
  product: MappedStorefrontProduct;
  brandName: string;
};

type PurchaseUiState = "idle" | "adding" | "added" | "error";

export function ProductHero({ product, brandName }: ProductHeroProps) {
  const { applyCart, openBag } = useCart();
  const colours = product.colours;
  const initialColour =
    colours.find((colour) => colour.available) ?? colours[0];
  const [colourId, setColourId] = useState(initialColour?.id ?? "");
  const [size, setSize] = useState(product.sizes?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [ui, setUi] = useState<PurchaseUiState>("idle");
  const [sticky, setSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ctaRef.current;
    if (!node) {
      return;
    }
    const cta = node;

    const desktopQuery = window.matchMedia("(min-width: 1200px)");

    function ctaInView() {
      const rect = cta.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function syncSticky() {
      setSticky(!desktopQuery.matches && !ctaInView());
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(syncSticky, { threshold: 0 });

    observer?.observe(cta);
    desktopQuery.addEventListener("change", syncSticky);
    window.addEventListener("scroll", syncSticky, { passive: true });
    window.addEventListener("resize", syncSticky);
    syncSticky();
    return () => {
      observer?.disconnect();
      desktopQuery.removeEventListener("change", syncSticky);
      window.removeEventListener("scroll", syncSticky);
      window.removeEventListener("resize", syncSticky);
    };
  }, []);
  const colour = colours.find((item) => item.id === colourId);
  const colourCount = getColourCount(product);
  const available = isProductAvailable(product) && Boolean(colour?.available);
  const variant = resolveSelectedVariant(product, {
    colourId: colour?.id,
    size: size || undefined,
  });
  const needsVariant = (product.variants?.length ?? 0) > 0;
  const variantBlocked = variant ? variant.availability !== "in_stock" : needsVariant;
  const canPurchase = available && !variantBlocked;
  const compare =
    product.compareAtPrice != null && product.compareAtPrice > product.price
      ? product.compareAtPrice
      : undefined;
  const save = compare != null ? compare - product.price : 0;

  const statusCopy = useMemo(() => {
    if (ui === "error") {
      return "Couldn't add to bag. Please try again.";
    }
    return "";
  }, [ui]);

  const ctaLabel = buttonLabel(ui, canPurchase, product.availability);

  function resetReady() {
    if (ui === "added" || ui === "error") {
      setUi("idle");
    }
  }

  async function handleAdd() {
    if (!canPurchase || !colour || ui === "adding") {
      return;
    }
    setUi("adding");
    const payload = {
      slug: product.slug,
      colourId: colour.id,
      quantity,
      ...(size ? { size } : {}),
      ...(variant?.id ? { variantId: variant.id } : {}),
    };
    let result: PublicAddToBagResult;
    try {
      result = await addToBagAction(payload);
    } catch {
      setUi("error");
      return;
    }
    if (result.status === "added") {
      applyCart(result.cart);
      openBag();
      setUi("added");
      track("add_to_cart", {
        item_id: product.id,
        item_name: product.name,
        item_variant: variant?.id ?? colour.id,
        quantity,
        price: product.price,
        currency: product.currency,
      });
      return;
    }
    setUi("error");
  }

  return (
    <>
      <div className={styles.hero}>
          <ProductGallery
            key={product.slug}
            images={product.images}
            productName={product.name}
          />
        <div className={styles.info}>
          {brandName ? <p className={`text-micro ${styles.brand}`}>{brandName}</p> : null}
          <h1 className="text-h2">{product.name}</h1>
          <p className={`text-h3 ${styles.price}`}>{formatGbp(product.price)}</p>
          {compare != null ? (
            <>
              <p className={`text-small ${styles.compare}`}>{formatGbp(compare)}</p>
              {save > 0 ? (
                <p className={`text-micro ${styles.save}`}>Save {formatGbp(save)}</p>
              ) : null}
            </>
          ) : null}
          {colourCount > 0 ? (
            <p className={`text-micro ${styles.count}`}>
              {colourCount} {colourCount === 1 ? "colour" : "colours"}
            </p>
          ) : null}
          {colour ? (
            <p className={`text-micro ${styles.colourName}`}>
              Colour — {colour.name}
            </p>
          ) : null}
          {colours.length > 0 ? (
            <ul className={styles.swatches} aria-label="Colour">
              {colours.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.swatch}
                    aria-pressed={item.id === colourId}
                    aria-label={item.name}
                    disabled={!item.available}
                    onClick={() => {
                      setColourId(item.id);
                      resetReady();
                      track("select_colour", {
                        item_id: product.id,
                        item_name: product.name,
                        colour_id: item.id,
                      });
                    }}
                  >
                    <span
                      className={styles.dot}
                      style={item.hex ? { background: item.hex } : undefined}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {hasMeasurements(product) ? (
            <div className={styles.fit}>
              <p className="text-micro">Frame size</p>
              <ul className="text-small">
                {product.measurements?.lensMm != null ? (
                  <li>Lens Width — {product.measurements.lensMm} mm</li>
                ) : null}
                {product.measurements?.bridgeMm != null ? (
                  <li>Bridge Width — {product.measurements.bridgeMm} mm</li>
                ) : null}
                {product.measurements?.templeMm != null ? (
                  <li>Temple Length — {product.measurements.templeMm} mm</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {product.pdp?.fit ? (
            <p className={`text-micro ${styles.fit}`}>{product.pdp.fit}</p>
          ) : null}
          {product.sizes && product.sizes.length > 0 ? (
            <div>
              <p className="text-micro">Size</p>
              <div className={styles.sizes} role="group" aria-label="Size">
                {product.sizes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.size}
                    aria-pressed={value === size}
                    onClick={() => {
                      setSize(value);
                      resetReady();
                      track("select_size", {
                        item_id: product.id,
                        item_name: product.name,
                        size: value,
                      });
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <SizeFaceGuide measurements={product.measurements} />
          <div className={styles.quantity}>
            <span className="text-micro" id="pdp-quantity-label">
              Quantity
            </span>
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || ui === "adding"}
              onClick={() => {
                setQuantity((value) => Math.max(1, value - 1));
                resetReady();
              }}
            >
              −
            </button>
            <span aria-labelledby="pdp-quantity-label" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= ADD_TO_BAG_QUANTITY_MAX || ui === "adding"}
              onClick={() => {
                setQuantity((value) => Math.min(ADD_TO_BAG_QUANTITY_MAX, value + 1));
                resetReady();
              }}
            >
              +
            </button>
          </div>
          <div className={styles.cta} ref={ctaRef} inert={sticky || undefined}>
            <Button
              onClick={handleAdd}
              loading={ui === "adding"}
              disabled={!canPurchase || ui === "adding"}
            >
              {ctaLabel}
            </Button>
          </div>
          {statusCopy ? (
            <p className={`text-small ${styles.note}`} role="status" aria-live="polite">
              {statusCopy}
            </p>
          ) : null}
          {!canPurchase ? (
            <p className={`text-micro ${styles.status}`}>
              {getAvailabilityLabel(
                variantBlocked && variant ? variant.availability : product.availability,
              )}
            </p>
          ) : null}
          <div className={styles.shipping}>
            <p className="text-micro">Shipping</p>
            <p className="text-small">
              Minimum 2-week delivery timeframe.
            </p>
          </div>
          <div className={styles.payment}>
            <p className="text-micro">Payment</p>
            <p className="text-small">Secure card payment</p>
            <p className="text-small">All major cards accepted</p>
          </div>
        </div>
      </div>
      <ProductContent product={product} colour={colour} />
      {sticky ? (
        <div
          className={cx(styles.sticky, styles.stickyVisible)}
          data-sticky-purchase="true"
        >
          <div className={styles.stickyCopy}>
            <p className="text-small">
              {product.name} — {formatGbp(product.price)}
            </p>
          </div>
          <Button
            onClick={handleAdd}
            loading={ui === "adding"}
            disabled={!canPurchase || ui === "adding"}
          >
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function buttonLabel(
  ui: PurchaseUiState,
  canPurchase: boolean,
  availability: MappedStorefrontProduct["availability"],
): string {
  if (!canPurchase) {
    return getAvailabilityLabel(availability);
  }
  if (ui === "adding") {
    return "Adding";
  }
  if (ui === "added") {
    return "Added";
  }
  if (ui === "error") {
    return "Couldn't add to bag";
  }
  return "Add to bag";
}

function hasMeasurements(product: MappedStorefrontProduct): boolean {
  const measurements = product.measurements;
  return Boolean(
    measurements &&
      (measurements.lensMm != null ||
        measurements.bridgeMm != null ||
        measurements.templeMm != null),
  );
}

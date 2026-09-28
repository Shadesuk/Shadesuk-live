"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_CATALOGUE_STATUS_LABELS,
  ADMIN_DEFAULT_DISCLOSURE,
  ADMIN_FIT_VALUES,
  ADMIN_PRODUCT_LONG_TEXT_MAX,
  ADMIN_PRODUCT_SKU_MAX,
  ADMIN_PRODUCT_TEXT_MAX,
  GENDERS,
  SHAPES,
  adminProductSlugFromName,
  formatGbpMajorInput,
  groupVariantsByColour,
  parseAdminFit,
  suggestedVariantSku,
  type AdminProductCollectionOption,
  type AdminProductDetailView,
  type AdminProductImageView,
  type AdminProductPlacementView,
  type AdminProductVariantView,
} from "@/contracts/admin/products";
import { canArchiveProduct, canDeleteProduct, type AdminV1Role } from "@/contracts/admin/roles";
import {
  saveAdminProductAction,
  type AdminProductActionState,
} from "@/app/admin/products/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect, FieldTextarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  ADMIN_PRODUCT_ARCHIVE,
  ADMIN_PRODUCT_ARCHIVE_CONFIRM,
  ADMIN_PRODUCT_ATTRIBUTES,
  ADMIN_PRODUCT_BACK,
  ADMIN_PRODUCT_BRAND,
  ADMIN_PRODUCT_BRIDGE_WIDTH,
  ADMIN_PRODUCT_CANCEL,
  ADMIN_PRODUCT_COLLECTIONS,
  ADMIN_PRODUCT_COLLECTIONS_HINT,
  ADMIN_PRODUCT_COLOUR_ADD,
  ADMIN_PRODUCT_COLOUR_ADD_NEW,
  ADMIN_PRODUCT_COLOUR_EDIT,
  ADMIN_PRODUCT_COLOUR_EMPTY_BODY,
  ADMIN_PRODUCT_COLOUR_EMPTY_TITLE,
  ADMIN_PRODUCT_COLOUR_REMOVE,
  ADMIN_PRODUCT_COLOUR_SAVE,
  ADMIN_PRODUCT_COLOURS,
  ADMIN_PRODUCT_DELETE,
  ADMIN_PRODUCT_DELETE_ACTION,
  ADMIN_PRODUCT_DELETE_CONFIRM,
  ADMIN_PRODUCT_DESCRIPTION,
  ADMIN_PRODUCT_DISCLOSURE,
  ADMIN_PRODUCT_FIT,
  ADMIN_PRODUCT_FIT_HINT,
  ADMIN_PRODUCT_FIT_UNSPECIFIED,
  ADMIN_PRODUCT_GENDER,
  ADMIN_PRODUCT_INCLUDED,
  ADMIN_PRODUCT_INFORMATION,
  ADMIN_PRODUCT_KEEP_EDITING,
  ADMIN_PRODUCT_LEAVE,
  ADMIN_PRODUCT_LENS_WIDTH,
  ADMIN_PRODUCT_MATERIALS,
  ADMIN_PRODUCT_MEASUREMENTS,
  ADMIN_PRODUCT_MM,
  ADMIN_PRODUCT_NAME,
  ADMIN_PRODUCT_PLACEMENT,
  ADMIN_PRODUCT_PLACEMENT_BEST_SELLER,
  ADMIN_PRODUCT_PLACEMENT_FEATURED,
  ADMIN_PRODUCT_PLACEMENT_FLAGSHIP,
  ADMIN_PRODUCT_PLACEMENT_HOMEPAGE,
  ADMIN_PRODUCT_PLACEMENT_NEW_ARRIVAL,
  ADMIN_PRODUCT_PREVIEW,
  ADMIN_PRODUCT_PUBLISH,
  ADMIN_PRODUCT_SAVE,
  ADMIN_PRODUCT_SAVE_DRAFT,
  ADMIN_PRODUCT_SAVE_FAILED_BODY,
  ADMIN_PRODUCT_SAVE_FAILED_TITLE,
  ADMIN_PRODUCT_SAVED_JUST_NOW,
  ADMIN_PRODUCT_SAVING,
  ADMIN_PRODUCT_SHAPE,
  ADMIN_PRODUCT_SIZE_ADD,
  ADMIN_PRODUCT_SLUG,
  ADMIN_PRODUCT_SLUG_HINT,
  ADMIN_PRODUCT_TEMPLE_LENGTH,
  ADMIN_PRODUCT_UNPUBLISH,
  ADMIN_PRODUCT_UNSAVED,
  ADMIN_PRODUCT_UNSAVED_TITLE,
  ADMIN_PRODUCT_VARIANT_COLOUR,
  ADMIN_PRODUCT_VARIANT_COMPARE,
  ADMIN_PRODUCT_VARIANT_COMPARE_HINT,
  ADMIN_PRODUCT_VARIANT_PRICE,
  ADMIN_PRODUCT_VARIANT_REMOVE,
  ADMIN_PRODUCT_VARIANT_SIZE,
  ADMIN_PRODUCT_VARIANT_SKU,
  ADMIN_PRODUCT_VARIANT_STOCK,
  ADMIN_PRODUCT_VARIANTS_EMPTY_BODY,
  ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE,
  ADMIN_PRODUCTS_RETRY,
  ADMIN_MERCHANDISING_NO,
  ADMIN_MERCHANDISING_YES,
} from "@/lib/admin-copy";
import { productPath, routes } from "@/lib/navigation";
import { AdminProductImages } from "./AdminProductImages";
import { AdminPageHeader } from "./AdminPageHeader";
import styles from "./AdminProducts.module.css";

const idle: AdminProductActionState = { status: "idle" };

type DraftVariant = {
  key: string;
  id: string;
  sku: string;
  colourName: string;
  sizeName: string;
  price: string;
  compareAt: string;
  stock: string;
};

type DraftColour = {
  key: string;
  colourName: string;
  open: boolean;
  sizes: DraftVariant[];
};

function toDraft(variant: AdminProductVariantView): DraftVariant {
  return {
    key: variant.id,
    id: variant.id,
    sku: variant.sku,
    colourName: variant.colourName,
    sizeName: variant.sizeName ?? "",
    price: formatGbpMajorInput(variant.priceMinor),
    compareAt: formatGbpMajorInput(variant.compareAtMinor),
    stock: String(variant.stockQuantity),
  };
}

function emptySize(colourName = ""): DraftVariant {
  return {
    key: `new-${crypto.randomUUID()}`,
    id: "",
    sku: "",
    colourName,
    sizeName: "",
    price: "",
    compareAt: "",
    stock: "0",
  };
}

function emptyColour(open = true): DraftColour {
  return {
    key: `colour-${crypto.randomUUID()}`,
    colourName: "",
    open,
    sizes: [emptySize()],
  };
}

function coloursFromProduct(product: AdminProductDetailView | null): DraftColour[] {
  if (!product?.variants.length) {
    return [];
  }
  return groupVariantsByColour(product.variants).map((group) => ({
    key: `colour-${group.colourName.toLowerCase()}`,
    colourName: group.colourName,
    open: false,
    sizes: group.variants.map(toDraft),
  }));
}

export function AdminProductEditor({
  product,
  role,
  collections,
  images,
}: {
  product: AdminProductDetailView | null;
  role: AdminV1Role;
  collections: AdminProductCollectionOption[];
  images: AdminProductImageView[];
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [colours, setColours] = useState<DraftColour[]>(() => coloursFromProduct(product));
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [state, action, pending] = useActionState(async (prev: AdminProductActionState, formData: FormData) => {
    const result = await saveAdminProductAction(prev, formData);
    if (result.status === "ok") {
      setDirty(false);
      setConfirm(null);
    }
    return result;
  }, idle);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = ADMIN_PRODUCT_UNSAVED;
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const markDirty = () => setDirty(true);
  const title = product?.name || "New product";
  const canArchive = canArchiveProduct(role);
  const canDelete = canDeleteProduct(role);
  const status = product?.status ?? "draft";
  const generatedSlug = product?.slug || adminProductSlugFromName(name);
  const variants = useMemo(
    () =>
      colours.flatMap((colour) =>
        colour.sizes.map((size) => ({ ...size, colourName: colour.colourName })),
      ),
    [colours],
  );
  const saveFailed = state.status === "error" || state.status === "forbidden" || state.status === "stale";
  const savedJustNow = state.status === "ok" && !dirty && !pending;

  function updateColour(key: string, patch: Partial<DraftColour>) {
    setColours((current) => current.map((colour) => (colour.key === key ? { ...colour, ...patch } : colour)));
    markDirty();
  }

  function updateSize(colourKey: string, sizeKey: string, patch: Partial<DraftVariant>) {
    setColours((current) =>
      current.map((colour) =>
        colour.key === colourKey
          ? {
              ...colour,
              sizes: colour.sizes.map((size) => (size.key === sizeKey ? { ...size, ...patch } : size)),
            }
          : colour,
      ),
    );
    markDirty();
  }

  return (
    <div data-admin-product-editor data-product-id={product?.id ?? "new"}>
      <AdminPageHeader
        kicker="Products"
        title={title}
        description={product ? ADMIN_CATALOGUE_STATUS_LABELS[product.status] : undefined}
        action={
          <Button
            type="button"
            variant="tertiary"
            onClick={() => {
              if (dirty) {
                setLeaveOpen(true);
                return;
              }
              router.push(routes.adminProducts);
            }}
          >
            {ADMIN_PRODUCT_BACK}
          </Button>
        }
      />
      <div className={styles.editor}>
        <form id="admin-product-form" className={styles.stack} action={action} onChange={markDirty} noValidate>
          {product ? <input type="hidden" name="productId" value={product.id} /> : null}
          {product ? <input type="hidden" name="updatedAt" value={product.updatedAt} /> : null}
          <input type="hidden" name="variantCount" value={String(variants.length)} />
          {images.length > 0 ? (
            <input type="hidden" name="imageOrder" value={images.map((image) => image.id).join(",")} />
          ) : null}
          <section className={styles.section} aria-labelledby="product-info-heading">
            <h2 id="product-info-heading" className={styles.sectionTitle}>
              {ADMIN_PRODUCT_INFORMATION}
            </h2>
            <div className={styles.formGrid}>
              <Field
                id="product-name"
                name="name"
                label={ADMIN_PRODUCT_NAME}
                value={name}
                maxLength={ADMIN_PRODUCT_TEXT_MAX}
                onChange={(event) => {
                  setName(event.target.value);
                  markDirty();
                }}
                error={state.errors?.name}
                required
              />
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_SLUG}</p>
                <p className={`text-small ${styles.slugValue}`} data-product-slug>
                  {generatedSlug || "—"}
                </p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_SLUG_HINT}</p>
                {state.errors?.slug ? (
                  <p className={`text-small ${styles.banner}`} role="alert">
                    {state.errors.slug}
                  </p>
                ) : null}
              </div>
              <Field
                id="product-brand"
                name="brand"
                label={ADMIN_PRODUCT_BRAND}
                defaultValue={product?.brand ?? ""}
                maxLength={ADMIN_PRODUCT_TEXT_MAX}
              />
              <FieldSelect
                id="product-fit"
                name="fit"
                label={ADMIN_PRODUCT_FIT}
                defaultValue={parseAdminFit(product?.fit)}
              >
                <option value="">{ADMIN_PRODUCT_FIT_UNSPECIFIED}</option>
                {ADMIN_FIT_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </FieldSelect>
            </div>
            <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_FIT_HINT}</p>
            <fieldset className={styles.quiet}>
              <legend className={styles.sectionTitle}>{ADMIN_PRODUCT_MEASUREMENTS}</legend>
              {state.errors?.measurements ? (
                <p className={`text-small ${styles.banner}`} role="alert">
                  {state.errors.measurements}
                </p>
              ) : null}
              <div className={styles.formGrid}>
                <Field
                  id="product-lens"
                  name="lensWidthMm"
                  label={`${ADMIN_PRODUCT_LENS_WIDTH} (${ADMIN_PRODUCT_MM})`}
                  inputMode="numeric"
                  defaultValue={product?.lensWidthMm ? String(product.lensWidthMm) : ""}
                />
                <Field
                  id="product-bridge"
                  name="bridgeWidthMm"
                  label={`${ADMIN_PRODUCT_BRIDGE_WIDTH} (${ADMIN_PRODUCT_MM})`}
                  inputMode="numeric"
                  defaultValue={product?.bridgeWidthMm ? String(product.bridgeWidthMm) : ""}
                />
                <Field
                  id="product-temple"
                  name="templeLengthMm"
                  label={`${ADMIN_PRODUCT_TEMPLE_LENGTH} (${ADMIN_PRODUCT_MM})`}
                  inputMode="numeric"
                  defaultValue={product?.templeLengthMm ? String(product.templeLengthMm) : ""}
                />
              </div>
            </fieldset>
            <FieldTextarea
              id="product-description"
              name="description"
              label={ADMIN_PRODUCT_DESCRIPTION}
              defaultValue={product?.description ?? ""}
              maxLength={ADMIN_PRODUCT_LONG_TEXT_MAX}
            />
            <FieldTextarea
              id="product-materials"
              name="materials"
              label={ADMIN_PRODUCT_MATERIALS}
              defaultValue={product?.materials ?? ""}
              maxLength={ADMIN_PRODUCT_LONG_TEXT_MAX}
            />
            <FieldTextarea
              id="product-included"
              name="whatsIncluded"
              label={ADMIN_PRODUCT_INCLUDED}
              defaultValue={product?.whatsIncluded ?? ""}
              maxLength={ADMIN_PRODUCT_LONG_TEXT_MAX}
            />
            <Field
              id="product-disclosure"
              name="disclosure"
              label={ADMIN_PRODUCT_DISCLOSURE}
              defaultValue={product?.disclosure || ADMIN_DEFAULT_DISCLOSURE}
              maxLength={ADMIN_PRODUCT_TEXT_MAX}
              error={state.errors?.disclosure}
            />
          </section>
          <AdminProductImages
            productId={product?.id ?? null}
            images={images.filter((image) => !image.variantId)}
            variants={product?.variants ?? []}
          />
          <section className={styles.section} aria-labelledby="product-colours-heading">
            <h2 id="product-colours-heading" className={styles.sectionTitle}>
              {ADMIN_PRODUCT_COLOURS}
            </h2>
            {state.errors?.variants || state.errors?.sku || state.errors?.price || state.errors?.sale ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {state.errors?.variants || state.errors?.sku || state.errors?.price || state.errors?.sale}
              </p>
            ) : null}
            {colours.length === 0 ? (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_COLOUR_EMPTY_TITLE}</p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_COLOUR_EMPTY_BODY}</p>
              </div>
            ) : null}
            {colours.map((colour, colourIndex) => {
              const colourImages = imagesForColour(images, colour, product?.variants ?? []);
              const sizeCount = colour.sizes.filter((size) => size.sizeName || size.sku).length;
              return (
                <article key={colour.key} className={styles.colour} data-colour-editor={colour.colourName || "new"}>
                  {colour.open ? (
                    <>
                      <Field
                        id={`colour-${colour.key}-name`}
                        label={ADMIN_PRODUCT_VARIANT_COLOUR}
                        value={colour.colourName}
                        maxLength={ADMIN_PRODUCT_TEXT_MAX}
                        onChange={(event) => updateColour(colour.key, { colourName: event.target.value })}
                      />
                      <h3 className={styles.sectionTitle}>Sizes</h3>
                      {colour.sizes.length === 0 ? (
                        <div className={styles.quiet}>
                          <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE}</p>
                          <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_VARIANTS_EMPTY_BODY}</p>
                        </div>
                      ) : null}
                      {colour.sizes.map((size, sizeIndex) => {
                        const variantIndex = variantIndexOf(variants, colour, size);
                        return (
                          <fieldset key={size.key} className={styles.variant}>
                            <legend className="visually-hidden">
                              {colour.colourName || "Colour"} size {sizeIndex + 1}
                            </legend>
                            {size.id ? <input type="hidden" name={`variant_${variantIndex}_id`} value={size.id} /> : null}
                            <input type="hidden" name={`variant_${variantIndex}_colourName`} value={colour.colourName} />
                            <Field
                              id={`variant-${variantIndex}-size`}
                              name={`variant_${variantIndex}_sizeName`}
                              label={ADMIN_PRODUCT_VARIANT_SIZE}
                              value={size.sizeName}
                              maxLength={ADMIN_PRODUCT_TEXT_MAX}
                              onChange={(event) =>
                                updateSize(colour.key, size.key, {
                                  sizeName: event.target.value,
                                  sku:
                                    size.sku || !generatedSlug
                                      ? size.sku
                                      : suggestedVariantSku(
                                          generatedSlug,
                                          colour.colourName,
                                          event.target.value || null,
                                        ),
                                })
                              }
                            />
                            <Field
                              id={`variant-${variantIndex}-sku`}
                              name={`variant_${variantIndex}_sku`}
                              label={ADMIN_PRODUCT_VARIANT_SKU}
                              value={size.sku}
                              maxLength={ADMIN_PRODUCT_SKU_MAX}
                              spellCheck={false}
                              autoComplete="off"
                              onChange={(event) => updateSize(colour.key, size.key, { sku: event.target.value })}
                            />
                            <Field
                              id={`variant-${variantIndex}-price`}
                              name={`variant_${variantIndex}_price`}
                              label={ADMIN_PRODUCT_VARIANT_PRICE}
                              inputMode="decimal"
                              value={size.price}
                              onChange={(event) => updateSize(colour.key, size.key, { price: event.target.value })}
                            />
                            <Field
                              id={`variant-${variantIndex}-compare`}
                              name={`variant_${variantIndex}_compareAt`}
                              label={ADMIN_PRODUCT_VARIANT_COMPARE}
                              hint={ADMIN_PRODUCT_VARIANT_COMPARE_HINT}
                              inputMode="decimal"
                              value={size.compareAt}
                              onChange={(event) => updateSize(colour.key, size.key, { compareAt: event.target.value })}
                            />
                            <Field
                              id={`variant-${variantIndex}-stock`}
                              name={`variant_${variantIndex}_stock`}
                              label={ADMIN_PRODUCT_VARIANT_STOCK}
                              inputMode="numeric"
                              value={size.stock}
                              onChange={(event) => updateSize(colour.key, size.key, { stock: event.target.value })}
                            />
                            <Button
                              type="button"
                              variant="tertiary"
                              onClick={() => {
                                updateColour(colour.key, {
                                  sizes: colour.sizes.filter((item) => item.key !== size.key),
                                });
                              }}
                            >
                              {ADMIN_PRODUCT_VARIANT_REMOVE}
                            </Button>
                          </fieldset>
                        );
                      })}
                      <div className={styles.filterActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const next = emptySize(colour.colourName);
                            next.sku = generatedSlug
                              ? suggestedVariantSku(generatedSlug, colour.colourName, null)
                              : "";
                            updateColour(colour.key, { sizes: [...colour.sizes, next] });
                          }}
                        >
                          {ADMIN_PRODUCT_SIZE_ADD}
                        </Button>
                      </div>
                      <AdminProductImages
                        productId={product?.id ?? null}
                        images={colourImages}
                        variants={savedVariantsForColour(product?.variants ?? [], colour.colourName)}
                        colourName={colour.colourName}
                        heading={`${colour.colourName || "Colour"} images`}
                      />
                      <div className={styles.filterActions}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (!colour.colourName.trim()) {
                              return;
                            }
                            updateColour(colour.key, { open: false });
                          }}
                        >
                          {ADMIN_PRODUCT_COLOUR_SAVE}
                        </Button>
                        <Button
                          type="button"
                          variant="tertiary"
                          onClick={() => {
                            setColours((current) => current.filter((item) => item.key !== colour.key));
                            markDirty();
                          }}
                        >
                          {ADMIN_PRODUCT_COLOUR_REMOVE}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.colourSummary}>
                      <div>
                        <p className="text-h3">{colour.colourName || `Colour ${colourIndex + 1}`}</p>
                        <p className="text-small">
                          {sizeCount} {sizeCount === 1 ? "size" : "sizes"}
                          {" · "}
                          {colourImages.length} {colourImages.length === 1 ? "image" : "images"}
                        </p>
                      </div>
                      <Button type="button" variant="secondary" onClick={() => updateColour(colour.key, { open: true })}>
                        {ADMIN_PRODUCT_COLOUR_EDIT}
                      </Button>
                      {colour.sizes.map((size) => {
                        const variantIndex = variantIndexOf(variants, colour, size);
                        return (
                          <div key={size.key} hidden>
                            {size.id ? <input type="hidden" name={`variant_${variantIndex}_id`} value={size.id} /> : null}
                            <input type="hidden" name={`variant_${variantIndex}_colourName`} value={colour.colourName} />
                            <input type="hidden" name={`variant_${variantIndex}_sizeName`} value={size.sizeName} />
                            <input type="hidden" name={`variant_${variantIndex}_sku`} value={size.sku} />
                            <input type="hidden" name={`variant_${variantIndex}_price`} value={size.price} />
                            <input type="hidden" name={`variant_${variantIndex}_compareAt`} value={size.compareAt} />
                            <input type="hidden" name={`variant_${variantIndex}_stock`} value={size.stock} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setColours((current) => [...current, emptyColour(true)]);
                markDirty();
              }}
            >
              {colours.length > 0 ? ADMIN_PRODUCT_COLOUR_ADD_NEW : ADMIN_PRODUCT_COLOUR_ADD}
            </Button>
          </section>
          <section className={styles.section} aria-labelledby="product-attr-heading">
            <h2 id="product-attr-heading" className={styles.sectionTitle}>
              {ADMIN_PRODUCT_ATTRIBUTES}
            </h2>
            <fieldset className={styles.quiet}>
              <legend className={styles.sectionTitle}>{ADMIN_PRODUCT_GENDER}</legend>
              <div className={styles.checkGrid}>
                {GENDERS.map((gender) => (
                  <label key={gender} className={styles.check}>
                    <input
                      type="checkbox"
                      name="gender"
                      value={gender}
                      defaultChecked={product?.genders.includes(gender)}
                    />
                    {gender}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.quiet}>
              <legend className={styles.sectionTitle}>{ADMIN_PRODUCT_SHAPE}</legend>
              <div className={styles.checkGrid}>
                {SHAPES.map((shape) => (
                  <label key={shape} className={styles.check}>
                    <input
                      type="checkbox"
                      name="shape"
                      value={shape}
                      defaultChecked={product?.shapes.includes(shape)}
                    />
                    {shape}
                  </label>
                ))}
              </div>
            </fieldset>
            {collections.length > 0 ? (
              <fieldset className={styles.quiet}>
                <legend className={styles.sectionTitle}>{ADMIN_PRODUCT_COLLECTIONS}</legend>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_COLLECTIONS_HINT}</p>
                <div className={styles.checkGrid}>
                  {collections.map((collection) => (
                    <label key={collection.id} className={styles.check}>
                      <input
                        type="checkbox"
                        name="collectionId"
                        value={collection.id}
                        defaultChecked={product?.collectionIds.includes(collection.id)}
                      />
                      {collection.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </section>
          {product ? <PlacementSummary placement={product.placement} slug={product.slug} status={status} /> : null}
          <section className={styles.section} aria-labelledby="product-publish-heading">
            <h2 id="product-publish-heading" className={styles.sectionTitle}>
              Publishing
            </h2>
            {formBanner(state, pending, savedJustNow)}
            <div className={styles.filterActions}>
              {status === "published" ? (
                <>
                  <Button type="submit" name="intent" value="save" variant="primary" loading={pending}>
                    {pending
                      ? ADMIN_PRODUCT_SAVING
                      : saveFailed
                        ? ADMIN_PRODUCTS_RETRY
                        : savedJustNow
                          ? `${ADMIN_PRODUCT_SAVED_JUST_NOW} ✓`
                          : ADMIN_PRODUCT_SAVE}
                  </Button>
                  <Button type="submit" name="intent" value="unpublish" variant="secondary" loading={pending}>
                    {ADMIN_PRODUCT_UNPUBLISH}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" name="intent" value="save" variant="secondary" loading={pending}>
                    {pending
                      ? ADMIN_PRODUCT_SAVING
                      : saveFailed
                        ? ADMIN_PRODUCTS_RETRY
                        : savedJustNow
                          ? `${ADMIN_PRODUCT_SAVED_JUST_NOW} ✓`
                          : ADMIN_PRODUCT_SAVE_DRAFT}
                  </Button>
                  {status !== "archived" ? (
                    <Button type="submit" name="intent" value="publish" variant="primary" loading={pending}>
                      {ADMIN_PRODUCT_PUBLISH}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
            {canArchive && product && status !== "archived" ? (
              <Button type="button" variant="tertiary" onClick={() => setConfirm("archive")}>
                {ADMIN_PRODUCT_ARCHIVE}
              </Button>
            ) : null}
            {canDelete && product ? (
              <Button type="button" variant="tertiary" onClick={() => setConfirm("delete")}>
                {ADMIN_PRODUCT_DELETE}
              </Button>
            ) : null}
          </section>
          {confirm ? (
            <Modal
              open
              onClose={() => setConfirm(null)}
              titleId="product-confirm-title"
              descriptionId="product-confirm-body"
            >
              <h2 id="product-confirm-title" className="text-h3">
                {confirm === "delete" ? ADMIN_PRODUCT_DELETE : ADMIN_PRODUCT_ARCHIVE}
              </h2>
              <p id="product-confirm-body" className="text-body">
                {confirm === "delete" ? ADMIN_PRODUCT_DELETE_CONFIRM : ADMIN_PRODUCT_ARCHIVE_CONFIRM} {title}
              </p>
              {state.status === "invalid" && state.errors?.status ? (
                <p className={`text-small ${styles.banner}`} role="alert">
                  {state.errors.status}
                </p>
              ) : null}
              {state.status === "forbidden" || state.status === "error" ? (
                <p className={`text-small ${styles.banner}`} role="alert">
                  {ADMIN_PRODUCT_SAVE_FAILED_TITLE}. {state.message}
                </p>
              ) : null}
              <div className={styles.filterActions}>
                <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
                  {ADMIN_PRODUCT_CANCEL}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value={confirm}
                  variant="primary"
                  loading={pending}
                  form="admin-product-form"
                >
                  {confirm === "delete" ? ADMIN_PRODUCT_DELETE_ACTION : ADMIN_PRODUCT_ARCHIVE}
                </Button>
              </div>
            </Modal>
          ) : null}
        </form>
      </div>
      {leaveOpen ? (
        <Modal
          open
          onClose={() => setLeaveOpen(false)}
          titleId="unsaved-title"
          descriptionId="unsaved-body"
        >
          <h2 id="unsaved-title" className="text-h3">
            {ADMIN_PRODUCT_UNSAVED_TITLE}
          </h2>
          <p id="unsaved-body" className="text-body">
            {ADMIN_PRODUCT_UNSAVED}
          </p>
          <div className={styles.filterActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDirty(false);
                setLeaveOpen(false);
                router.push(routes.adminProducts);
              }}
            >
              {ADMIN_PRODUCT_LEAVE}
            </Button>
            <Button type="button" variant="primary" onClick={() => setLeaveOpen(false)}>
              {ADMIN_PRODUCT_KEEP_EDITING}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function PlacementSummary({
  placement,
  slug,
  status,
}: {
  placement: AdminProductPlacementView;
  slug: string;
  status: string;
}) {
  const homepage = [
    placement.featured ? ADMIN_PRODUCT_PLACEMENT_FEATURED : null,
    placement.bestSeller ? ADMIN_PRODUCT_PLACEMENT_BEST_SELLER : null,
    placement.flagship ? ADMIN_PRODUCT_PLACEMENT_FLAGSHIP : null,
  ].filter(Boolean);
  const newArrival =
    placement.newArrival && placement.newArrivalDaysRemaining
      ? `${ADMIN_MERCHANDISING_YES} — ${placement.newArrivalDaysRemaining} days remaining`
      : ADMIN_MERCHANDISING_NO;
  return (
    <section className={styles.section} aria-labelledby="product-placement-heading">
      <h2 id="product-placement-heading" className={styles.sectionTitle}>
        {ADMIN_PRODUCT_PLACEMENT}
      </h2>
      <dl className={styles.placement}>
        <div>
          <dt>Status</dt>
          <dd>{ADMIN_CATALOGUE_STATUS_LABELS[placement.status]}</dd>
        </div>
        <div>
          <dt>Collections</dt>
          <dd>{placement.collectionNames.length ? placement.collectionNames.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>{ADMIN_PRODUCT_PLACEMENT_HOMEPAGE}</dt>
          <dd>{homepage.length ? homepage.join(", ") : "Not featured"}</dd>
        </div>
        <div>
          <dt>{ADMIN_PRODUCT_PLACEMENT_NEW_ARRIVAL}</dt>
          <dd>{newArrival}</dd>
        </div>
        <div>
          <dt>{ADMIN_PRODUCT_PLACEMENT_BEST_SELLER}</dt>
          <dd>{placement.bestSeller ? ADMIN_MERCHANDISING_YES : ADMIN_MERCHANDISING_NO}</dd>
        </div>
        <div>
          <dt>{ADMIN_PRODUCT_PLACEMENT_FLAGSHIP}</dt>
          <dd>{placement.flagship ? ADMIN_MERCHANDISING_YES : ADMIN_MERCHANDISING_NO}</dd>
        </div>
      </dl>
      {status === "published" ? (
        <ButtonLink href={productPath(slug)} variant="tertiary">
          {ADMIN_PRODUCT_PREVIEW}
        </ButtonLink>
      ) : null}
    </section>
  );
}

function formBanner(state: AdminProductActionState, pending: boolean, savedJustNow: boolean) {
  if (pending) {
    return (
      <p className={`text-small ${styles.banner}`} role="status">
        {ADMIN_PRODUCT_SAVING}…
      </p>
    );
  }
  if (savedJustNow) {
    return (
      <p className={`text-small ${styles.banner}`} role="status">
        {ADMIN_PRODUCT_SAVED_JUST_NOW} ✓
      </p>
    );
  }
  if (state.status === "invalid" && state.errors?.status) {
    return (
      <p className={`text-small ${styles.banner}`} role="alert">
        {state.errors.status}
      </p>
    );
  }
  if (state.status === "error" || state.status === "forbidden" || state.status === "stale") {
    return (
      <div className={styles.quiet} role="alert">
        <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_SAVE_FAILED_TITLE}</p>
        <p className={`text-small ${styles.banner}`}>{state.message || ADMIN_PRODUCT_SAVE_FAILED_BODY}</p>
      </div>
    );
  }
  return null;
}

function variantIndexOf(variants: DraftVariant[], colour: DraftColour, size: DraftVariant): number {
  return variants.findIndex(
    (variant) => variant.key === size.key && variant.colourName === colour.colourName,
  );
}

function savedVariantsForColour(
  variants: AdminProductVariantView[],
  colourName: string,
): AdminProductVariantView[] {
  const key = colourName.trim().toLowerCase();
  return variants.filter((variant) => variant.colourName.trim().toLowerCase() === key);
}

function imagesForColour(
  images: AdminProductImageView[],
  colour: DraftColour,
  variants: AdminProductVariantView[],
): AdminProductImageView[] {
  const ids = new Set(savedVariantsForColour(variants, colour.colourName).map((variant) => variant.id));
  if (ids.size === 0) {
    return [];
  }
  return images.filter((image) => image.variantId && ids.has(image.variantId));
}

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ADMIN_CATALOGUE_STATUS_LABELS,
  ADMIN_DEFAULT_DISCLOSURE,
  ADMIN_PRODUCT_LONG_TEXT_MAX,
  ADMIN_PRODUCT_SKU_MAX,
  ADMIN_PRODUCT_TEXT_MAX,
  ADMIN_VARIANT_STATUS_LABELS,
  GENDERS,
  SHAPES,
  VARIANT_STATUSES,
  adminProductSlugFromName,
  formatGbpMajorInput,
  suggestedVariantSku,
  variantCombinations,
  type AdminProductCollectionOption,
  type AdminProductDetailView,
  type AdminProductImageView,
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
  ADMIN_PRODUCT_CANCEL,
  ADMIN_PRODUCT_COLLECTIONS,
  ADMIN_PRODUCT_COLLECTIONS_HINT,
  ADMIN_PRODUCT_DELETE,
  ADMIN_PRODUCT_DELETE_ACTION,
  ADMIN_PRODUCT_DELETE_CONFIRM,
  ADMIN_PRODUCT_DESCRIPTION,
  ADMIN_PRODUCT_DISCLOSURE,
  ADMIN_PRODUCT_FIT,
  ADMIN_PRODUCT_GENDER,
  ADMIN_PRODUCT_GENERATE,
  ADMIN_PRODUCT_GENERATE_COLOURS,
  ADMIN_PRODUCT_GENERATE_HINT,
  ADMIN_PRODUCT_GENERATE_SIZES,
  ADMIN_PRODUCT_INCLUDED,
  ADMIN_PRODUCT_INFORMATION,
  ADMIN_PRODUCT_MATERIALS,
  ADMIN_PRODUCT_NAME,
  ADMIN_PRODUCT_PUBLISH,
  ADMIN_PRODUCT_SAVE,
  ADMIN_PRODUCT_SAVE_DRAFT,
  ADMIN_PRODUCT_SAVE_FAILED_TITLE,
  ADMIN_PRODUCT_SAVED,
  ADMIN_PRODUCT_SHAPE,
  ADMIN_PRODUCT_SLUG,
  ADMIN_PRODUCT_SLUG_HINT,
  ADMIN_PRODUCT_UNPUBLISH,
  ADMIN_PRODUCT_UNSAVED,
  ADMIN_PRODUCT_VARIANT_ADD,
  ADMIN_PRODUCT_VARIANT_COLOUR,
  ADMIN_PRODUCT_VARIANT_COMPARE,
  ADMIN_PRODUCT_VARIANT_COMPARE_HINT,
  ADMIN_PRODUCT_VARIANT_PRICE,
  ADMIN_PRODUCT_VARIANT_REMOVE,
  ADMIN_PRODUCT_VARIANT_SIZE,
  ADMIN_PRODUCT_VARIANT_SKU,
  ADMIN_PRODUCT_VARIANT_STATUS,
  ADMIN_PRODUCT_VARIANT_STOCK,
  ADMIN_PRODUCT_VARIANTS,
  ADMIN_PRODUCT_VARIANTS_EMPTY_BODY,
  ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE,
  ADMIN_PRODUCTS_RETRY,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
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
  status: string;
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
    status: variant.status,
  };
}

function emptyVariant(): DraftVariant {
  return {
    key: `new-${crypto.randomUUID()}`,
    id: "",
    sku: "",
    colourName: "",
    sizeName: "",
    price: "",
    compareAt: "",
    stock: "0",
    status: "draft",
  };
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
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [variants, setVariants] = useState<DraftVariant[]>(
    product?.variants.length ? product.variants.map(toDraft) : [emptyVariant()],
  );
  const [generateColours, setGenerateColours] = useState("");
  const [generateSizes, setGenerateSizes] = useState("");
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
  const collectionChoices = useMemo(() => collections, [collections]);

  function updateVariant(index: number, patch: Partial<DraftVariant>) {
    setVariants((current) =>
      current.map((variant, item) => (item === index ? { ...variant, ...patch } : variant)),
    );
    markDirty();
  }

  function addCombinations() {
    const created = variantCombinations(generateColours.split("\n"), generateSizes.split("\n"));
    setVariants((current) => {
      const next = [...current.filter((variant) => variant.colourName || variant.sku)];
      for (const combo of created) {
        const exists = next.some(
          (variant) =>
            variant.colourName.toLowerCase() === combo.colourName.toLowerCase() &&
            (variant.sizeName || "") === (combo.sizeName ?? ""),
        );
        if (exists) {
          continue;
        }
        next.push({
          ...emptyVariant(),
          colourName: combo.colourName,
          sizeName: combo.sizeName ?? "",
          sku: suggestedVariantSku(slug, combo.colourName, combo.sizeName),
          status: "draft",
        });
      }
      return next.length > 0 ? next : [emptyVariant()];
    });
    markDirty();
  }

  return (
    <div data-admin-product-editor data-product-id={product?.id ?? "new"}>
      <AdminPageHeader
        kicker="Products"
        title={title}
        description={product ? ADMIN_CATALOGUE_STATUS_LABELS[product.status] : undefined}
        action={
          <ButtonLink
            href={routes.adminProducts}
            variant="tertiary"
            onClick={(event) => {
              if (dirty && !window.confirm(ADMIN_PRODUCT_UNSAVED)) {
                event.preventDefault();
              }
            }}
          >
            {ADMIN_PRODUCT_BACK}
          </ButtonLink>
        }
      />
      <div className={styles.editor}>
        <form id="admin-product-form" className={styles.stack} action={action} onChange={markDirty} noValidate>
          {product ? <input type="hidden" name="productId" value={product.id} /> : null}
          {product ? <input type="hidden" name="updatedAt" value={product.updatedAt} /> : null}
          <input type="hidden" name="variantCount" value={String(variants.length)} />
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
                  const next = event.target.value;
                  setName(next);
                  if (!slugTouched && !product) {
                    setSlug(adminProductSlugFromName(next));
                  }
                }}
                error={state.errors?.name}
                required
              />
              <Field
                id="product-slug"
                name="slug"
                label={ADMIN_PRODUCT_SLUG}
                hint={ADMIN_PRODUCT_SLUG_HINT}
                value={slug}
                maxLength={ADMIN_PRODUCT_TEXT_MAX}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                error={state.errors?.slug}
                required
              />
              <Field
                id="product-brand"
                name="brand"
                label={ADMIN_PRODUCT_BRAND}
                defaultValue={product?.brand ?? ""}
                maxLength={ADMIN_PRODUCT_TEXT_MAX}
              />
              <Field
                id="product-fit"
                name="fit"
                label={ADMIN_PRODUCT_FIT}
                defaultValue={product?.fit ?? ""}
                maxLength={ADMIN_PRODUCT_TEXT_MAX}
              />
            </div>
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
            {collectionChoices.length > 0 ? (
              <fieldset className={styles.quiet}>
                <legend className={styles.sectionTitle}>{ADMIN_PRODUCT_COLLECTIONS}</legend>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_COLLECTIONS_HINT}</p>
                <div className={styles.checkGrid}>
                  {collectionChoices.map((collection) => (
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
          <section className={styles.section} aria-labelledby="product-variants-heading">
            <h2 id="product-variants-heading" className={styles.sectionTitle}>
              {ADMIN_PRODUCT_VARIANTS}
            </h2>
            {state.errors?.variants || state.errors?.sku || state.errors?.price || state.errors?.sale ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {state.errors?.variants || state.errors?.sku || state.errors?.price || state.errors?.sale}
              </p>
            ) : null}
            {variants.length === 0 ? (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_VARIANTS_EMPTY_TITLE}</p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_VARIANTS_EMPTY_BODY}</p>
              </div>
            ) : null}
            {variants.map((variant, index) => (
              <fieldset key={variant.key} className={styles.variant}>
                <legend className="visually-hidden">
                  {ADMIN_PRODUCT_VARIANTS} {index + 1}
                </legend>
                {variant.id ? <input type="hidden" name={`variant_${index}_id`} value={variant.id} /> : null}
                <Field
                  id={`variant-${index}-colour`}
                  name={`variant_${index}_colourName`}
                  label={ADMIN_PRODUCT_VARIANT_COLOUR}
                  value={variant.colourName}
                  maxLength={ADMIN_PRODUCT_TEXT_MAX}
                  onChange={(event) =>
                    updateVariant(index, {
                      colourName: event.target.value,
                      sku:
                        variant.sku || !slug
                          ? variant.sku
                          : suggestedVariantSku(slug, event.target.value, variant.sizeName || null),
                    })
                  }
                />
                <Field
                  id={`variant-${index}-size`}
                  name={`variant_${index}_sizeName`}
                  label={ADMIN_PRODUCT_VARIANT_SIZE}
                  value={variant.sizeName}
                  maxLength={ADMIN_PRODUCT_TEXT_MAX}
                  onChange={(event) => updateVariant(index, { sizeName: event.target.value })}
                />
                <Field
                  id={`variant-${index}-sku`}
                  name={`variant_${index}_sku`}
                  label={ADMIN_PRODUCT_VARIANT_SKU}
                  value={variant.sku}
                  maxLength={ADMIN_PRODUCT_SKU_MAX}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => updateVariant(index, { sku: event.target.value })}
                />
                <Field
                  id={`variant-${index}-price`}
                  name={`variant_${index}_price`}
                  label={ADMIN_PRODUCT_VARIANT_PRICE}
                  inputMode="decimal"
                  value={variant.price}
                  onChange={(event) => updateVariant(index, { price: event.target.value })}
                />
                <Field
                  id={`variant-${index}-compare`}
                  name={`variant_${index}_compareAt`}
                  label={ADMIN_PRODUCT_VARIANT_COMPARE}
                  hint={ADMIN_PRODUCT_VARIANT_COMPARE_HINT}
                  inputMode="decimal"
                  value={variant.compareAt}
                  onChange={(event) => updateVariant(index, { compareAt: event.target.value })}
                />
                <Field
                  id={`variant-${index}-stock`}
                  name={`variant_${index}_stock`}
                  label={ADMIN_PRODUCT_VARIANT_STOCK}
                  inputMode="numeric"
                  value={variant.stock}
                  onChange={(event) => updateVariant(index, { stock: event.target.value })}
                />
                <FieldSelect
                  id={`variant-${index}-status`}
                  name={`variant_${index}_status`}
                  label={ADMIN_PRODUCT_VARIANT_STATUS}
                  value={variant.status}
                  onChange={(event) => updateVariant(index, { status: event.target.value })}
                >
                  {VARIANT_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {ADMIN_VARIANT_STATUS_LABELS[value]}
                    </option>
                  ))}
                </FieldSelect>
                <Button
                  type="button"
                  variant="tertiary"
                  onClick={() => {
                    setVariants((current) => current.filter((_, item) => item !== index));
                    markDirty();
                  }}
                >
                  {ADMIN_PRODUCT_VARIANT_REMOVE}
                </Button>
              </fieldset>
            ))}
            <div className={styles.filterActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setVariants((current) => [...current, emptyVariant()]);
                  markDirty();
                }}
              >
                {ADMIN_PRODUCT_VARIANT_ADD}
              </Button>
            </div>
            <FieldTextarea
              id="generate-colours"
              label={ADMIN_PRODUCT_GENERATE_COLOURS}
              hint={ADMIN_PRODUCT_GENERATE_HINT}
              value={generateColours}
              onChange={(event) => setGenerateColours(event.target.value)}
            />
            <FieldTextarea
              id="generate-sizes"
              label={ADMIN_PRODUCT_GENERATE_SIZES}
              value={generateSizes}
              onChange={(event) => setGenerateSizes(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={addCombinations}>
              {ADMIN_PRODUCT_GENERATE}
            </Button>
          </section>
          <section className={styles.section} aria-labelledby="product-publish-heading">
            <h2 id="product-publish-heading" className={styles.sectionTitle}>
              Publishing
            </h2>
            {formBanner(state, pending)}
            <div className={styles.filterActions}>
              {status === "published" ? (
                <>
                  <Button type="submit" name="intent" value="save" variant="primary" loading={pending}>
                    {ADMIN_PRODUCT_SAVE}
                  </Button>
                  <Button type="submit" name="intent" value="unpublish" variant="secondary" loading={pending}>
                    {ADMIN_PRODUCT_UNPUBLISH}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" name="intent" value="save" variant="secondary" loading={pending}>
                    {state.status === "error" ? ADMIN_PRODUCTS_RETRY : ADMIN_PRODUCT_SAVE_DRAFT}
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
        <AdminProductImages productId={product?.id ?? null} images={images} variants={product?.variants ?? []} />
      </div>
    </div>
  );
}

function formBanner(state: AdminProductActionState, pending: boolean) {
  if (pending) {
    return null;
  }
  if (state.status === "ok") {
    return (
      <p className={`text-small ${styles.banner}`} role="status">
        {ADMIN_PRODUCT_SAVED}
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
      <p className={`text-small ${styles.banner}`} role="alert">
        {ADMIN_PRODUCT_SAVE_FAILED_TITLE}. {state.message}
      </p>
    );
  }
  return null;
}

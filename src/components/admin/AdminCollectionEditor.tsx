"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ADMIN_COLLECTION_STATUS_LABELS,
  adminCollectionSlugFromName,
  collectionVisibilityFromStatus,
  type AdminCollectionDetailView,
  type AdminCollectionProductRef,
} from "@/contracts/admin/collections";
import { ADMIN_CATALOGUE_STATUS_LABELS } from "@/contracts/admin/products";
import { canArchiveCollection, canDeleteCollection, type AdminV1Role } from "@/contracts/admin/roles";
import {
  saveAdminCollectionAction,
  type AdminCollectionActionState,
} from "@/app/admin/collections/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect, FieldTextarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import {
  ADMIN_COLLECTION_ADD_PRODUCT,
  ADMIN_COLLECTION_ARCHIVE,
  ADMIN_COLLECTION_ARCHIVE_CONFIRM,
  ADMIN_COLLECTION_BACK,
  ADMIN_COLLECTION_CANCEL,
  ADMIN_COLLECTION_DELETE,
  ADMIN_COLLECTION_DELETE_ACTION,
  ADMIN_COLLECTION_DELETE_CONFIRM,
  ADMIN_COLLECTION_DESCRIPTION,
  ADMIN_COLLECTION_DESCRIPTION_HINT,
  ADMIN_COLLECTION_HIDDEN,
  ADMIN_COLLECTION_INFORMATION,
  ADMIN_COLLECTION_NAME,
  ADMIN_COLLECTION_PREVIEW,
  ADMIN_COLLECTION_PRODUCT_COL_BRAND,
  ADMIN_COLLECTION_PRODUCT_COL_PRODUCT,
  ADMIN_COLLECTION_PRODUCT_COL_SKU,
  ADMIN_COLLECTION_PRODUCT_COL_STATUS,
  ADMIN_COLLECTION_PRODUCTS,
  ADMIN_COLLECTION_PRODUCTS_EMPTY_BODY,
  ADMIN_COLLECTION_PRODUCTS_EMPTY_TITLE,
  ADMIN_COLLECTION_PRODUCTS_HINT,
  ADMIN_COLLECTION_REMOVE_PRODUCT,
  ADMIN_COLLECTION_SAVE,
  ADMIN_COLLECTION_SAVE_FAILED_BODY,
  ADMIN_COLLECTION_SAVE_FAILED_TITLE,
  ADMIN_COLLECTION_SAVED_JUST_NOW,
  ADMIN_COLLECTION_SAVING,
  ADMIN_COLLECTION_SLUG,
  ADMIN_COLLECTION_SLUG_HINT,
  ADMIN_COLLECTION_VISIBLE,
  ADMIN_COLLECTION_VISIBILITY,
  ADMIN_COLLECTIONS_RETRY,
  ADMIN_PRODUCT_KEEP_EDITING,
  ADMIN_PRODUCT_LEAVE,
  ADMIN_PRODUCT_UNSAVED,
  ADMIN_PRODUCT_UNSAVED_TITLE,
} from "@/lib/admin-copy";
import { collectionPath, routes } from "@/lib/navigation";
import { AdminCollectionImage } from "./AdminCollectionImage";
import { AdminCollectionProductPicker } from "./AdminCollectionProductPicker";
import { AdminPageHeader } from "./AdminPageHeader";
import styles from "./AdminCollections.module.css";

const idle: AdminCollectionActionState = { status: "idle" };

export function AdminCollectionEditor({
  collection,
  role,
}: {
  collection: AdminCollectionDetailView | null;
  role: AdminV1Role;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [visibility, setVisibility] = useState<"visible" | "hidden">(
    collectionVisibilityFromStatus(collection?.status ?? "draft") === "visible" ? "visible" : "hidden",
  );
  const [products, setProducts] = useState<AdminCollectionProductRef[]>(collection?.products ?? []);
  const [state, action, pending] = useActionState(async (prev: AdminCollectionActionState, formData: FormData) => {
    const result = await saveAdminCollectionAction(prev, formData);
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
  const title = collection?.name || "New collection";
  const canArchive = canArchiveCollection(role);
  const canDelete = canDeleteCollection(role);
  const generatedSlug = collection?.slug || adminCollectionSlugFromName(name);
  const saveFailed = state.status === "error" || state.status === "forbidden" || state.status === "stale";
  const savedJustNow = state.status === "ok" && !dirty && !pending;
  const archived = collection?.status === "archived";

  return (
    <div data-admin-collection-editor data-collection-id={collection?.id ?? "new"}>
      <AdminPageHeader
        kicker="Collections"
        title={title}
        description={collection ? ADMIN_COLLECTION_STATUS_LABELS[collection.status] : undefined}
        action={
          <Button
            type="button"
            variant="tertiary"
            onClick={() => {
              if (dirty) {
                setLeaveOpen(true);
                return;
              }
              router.push(routes.adminCollections);
            }}
          >
            {ADMIN_COLLECTION_BACK}
          </Button>
        }
      />
      <div className={styles.editor}>
        <form id="admin-collection-form" action={action} className={styles.stack}>
          {collection?.id ? <input type="hidden" name="id" value={collection.id} /> : null}
          {collection?.updatedAt ? <input type="hidden" name="updatedAt" value={collection.updatedAt} /> : null}
          {products.map((product) => (
            <input key={product.id} type="hidden" name="productId" value={product.id} />
          ))}
          <section className={styles.section} aria-labelledby="collection-information-heading">
            <h2 id="collection-information-heading" className={styles.sectionTitle}>
              {ADMIN_COLLECTION_INFORMATION}
            </h2>
            <div className={styles.formGrid}>
              <Field
                id="collection-name"
                name="name"
                label={ADMIN_COLLECTION_NAME}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  markDirty();
                }}
                required
                error={state.errors?.name}
                autoComplete="off"
              />
              <div>
                <p className={styles.sectionTitle} id="collection-slug-label">
                  {ADMIN_COLLECTION_SLUG}
                </p>
                <p className={`text-small ${styles.slugValue}`} aria-labelledby="collection-slug-label">
                  {generatedSlug || "—"}
                </p>
                <p className="text-small">{ADMIN_COLLECTION_SLUG_HINT}</p>
                {state.errors?.slug ? (
                  <p className={`text-small ${styles.banner}`} role="alert">
                    {state.errors.slug}
                  </p>
                ) : null}
              </div>
              <FieldTextarea
                id="collection-description"
                name="description"
                label={ADMIN_COLLECTION_DESCRIPTION}
                hint={ADMIN_COLLECTION_DESCRIPTION_HINT}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  markDirty();
                }}
                rows={5}
                error={state.errors?.description}
              />
              <FieldSelect
                id="collection-visibility"
                name="visibility"
                label={ADMIN_COLLECTION_VISIBILITY}
                value={visibility}
                disabled={archived && !canArchive}
                onChange={(event) => {
                  setVisibility(event.target.value === "visible" ? "visible" : "hidden");
                  markDirty();
                }}
              >
                <option value="visible">{ADMIN_COLLECTION_VISIBLE}</option>
                <option value="hidden">{ADMIN_COLLECTION_HIDDEN}</option>
              </FieldSelect>
            </div>
          </section>
          <AdminCollectionImage
            collectionId={collection?.id ?? null}
            imageSrc={collection?.imageSrc ?? null}
            name={name || "Collection"}
          />
          <section className={styles.section} aria-labelledby="collection-products-heading">
            <h2 id="collection-products-heading" className={styles.sectionTitle}>
              {ADMIN_COLLECTION_PRODUCTS}
            </h2>
            <p className="text-small">{ADMIN_COLLECTION_PRODUCTS_HINT}</p>
            {products.length === 0 ? (
              <div className={styles.quiet}>
                <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_COLLECTION_PRODUCTS_EMPTY_TITLE}</p>
                <p className={`text-small ${styles.quietBody}`}>{ADMIN_COLLECTION_PRODUCTS_EMPTY_BODY}</p>
              </div>
            ) : (
              <ul className={styles.products} aria-label={ADMIN_COLLECTION_PRODUCTS}>
                {products.map((product) => (
                  <li key={product.id} className={styles.productRow}>
                    {product.imageSrc && product.imageWidth && product.imageHeight ? (
                      <Image
                        src={product.imageSrc}
                        alt=""
                        width={56}
                        height={56}
                        className={styles.thumb}
                        sizes="56px"
                      />
                    ) : (
                      <span className={styles.thumbEmpty} aria-hidden="true" />
                    )}
                    <div className={styles.productCopy}>
                      <p className="text-small">
                        <span className="visually-hidden">{ADMIN_COLLECTION_PRODUCT_COL_PRODUCT} </span>
                        {product.name}
                      </p>
                      <p className="text-small">
                        <span className="visually-hidden">{ADMIN_COLLECTION_PRODUCT_COL_BRAND} </span>
                        {product.brand || "—"}
                      </p>
                      <p className="text-small">
                        <span className="visually-hidden">{ADMIN_COLLECTION_PRODUCT_COL_SKU} </span>
                        {product.sku || "—"}
                      </p>
                      <p className="text-small">
                        <span className="visually-hidden">{ADMIN_COLLECTION_PRODUCT_COL_STATUS} </span>
                        {ADMIN_CATALOGUE_STATUS_LABELS[product.status]}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={() => {
                        setProducts((current) => current.filter((item) => item.id !== product.id));
                        markDirty();
                      }}
                    >
                      {ADMIN_COLLECTION_REMOVE_PRODUCT}
                      <span className="visually-hidden"> {product.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)}>
              {ADMIN_COLLECTION_ADD_PRODUCT}
            </Button>
            {state.errors?.products ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {state.errors.products}
              </p>
            ) : null}
          </section>
          <section className={styles.section} aria-labelledby="collection-save-heading">
            <h2 id="collection-save-heading" className="visually-hidden">
              Save
            </h2>
            {saveFailed ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {ADMIN_COLLECTION_SAVE_FAILED_TITLE}. {state.message ?? ADMIN_COLLECTION_SAVE_FAILED_BODY}
              </p>
            ) : null}
            {state.status === "invalid" && state.message ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {state.message}
              </p>
            ) : null}
            <p className="text-small" role="status" aria-live="polite">
              {pending
                ? `${ADMIN_COLLECTION_SAVING}…`
                : savedJustNow
                  ? `${ADMIN_COLLECTION_SAVED_JUST_NOW} ✓`
                  : null}
            </p>
            <div className={styles.filterActions}>
              <Button type="submit" name="intent" value="save" variant="primary" loading={pending}>
                {pending
                  ? ADMIN_COLLECTION_SAVING
                  : saveFailed
                    ? ADMIN_COLLECTIONS_RETRY
                    : savedJustNow
                      ? `${ADMIN_COLLECTION_SAVED_JUST_NOW} ✓`
                      : ADMIN_COLLECTION_SAVE}
              </Button>
              {collection?.status === "published" ? (
                <ButtonLink href={collectionPath(collection.slug)} variant="secondary">
                  {ADMIN_COLLECTION_PREVIEW}
                </ButtonLink>
              ) : null}
              {canArchive && collection && !archived ? (
                <Button type="button" variant="tertiary" onClick={() => setConfirm("archive")}>
                  {ADMIN_COLLECTION_ARCHIVE}
                </Button>
              ) : null}
              {canDelete && collection ? (
                <Button type="button" variant="tertiary" onClick={() => setConfirm("delete")}>
                  {ADMIN_COLLECTION_DELETE}
                </Button>
              ) : null}
            </div>
          </section>
          {confirm ? (
            <Modal
              open
              onClose={() => setConfirm(null)}
              titleId="collection-confirm-title"
              descriptionId="collection-confirm-body"
            >
              <h2 id="collection-confirm-title" className="text-h3">
                {confirm === "delete" ? ADMIN_COLLECTION_DELETE : ADMIN_COLLECTION_ARCHIVE}
              </h2>
              <p id="collection-confirm-body" className="text-body">
                {confirm === "delete" ? ADMIN_COLLECTION_DELETE_CONFIRM : ADMIN_COLLECTION_ARCHIVE_CONFIRM} {title}
              </p>
              <div className={styles.filterActions}>
                <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>
                  {ADMIN_COLLECTION_CANCEL}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value={confirm}
                  variant="primary"
                  loading={pending}
                  form="admin-collection-form"
                >
                  {confirm === "delete" ? ADMIN_COLLECTION_DELETE_ACTION : ADMIN_COLLECTION_ARCHIVE}
                </Button>
              </div>
            </Modal>
          ) : null}
        </form>
      </div>
      {pickerOpen ? (
        <AdminCollectionProductPicker
          open
          excludeIds={products.map((product) => product.id)}
          onSelect={(product) => {
            setProducts((current) =>
              current.some((item) => item.id === product.id) ? current : [...current, product],
            );
            setPickerOpen(false);
            markDirty();
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
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
                router.push(routes.adminCollections);
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

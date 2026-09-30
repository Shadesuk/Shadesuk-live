"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { AdminProductImageView, AdminProductVariantView } from "@/contracts/admin/products";
import {
  deleteAdminProductImageAction,
  moveAdminProductImageAction,
  uploadAdminProductImageAction,
  type AdminProductActionState,
} from "@/app/admin/products/actions";
import { Button } from "@/components/ui/Button";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_PRODUCT_IMAGE_ALT,
  ADMIN_PRODUCT_IMAGE_FILE,
  ADMIN_PRODUCT_IMAGE_MOVE_DOWN,
  ADMIN_PRODUCT_IMAGE_MOVE_UP,
  ADMIN_PRODUCT_IMAGE_NONE,
  ADMIN_PRODUCT_IMAGE_PRIMARY,
  ADMIN_PRODUCT_IMAGE_REMOVE,
  ADMIN_PRODUCT_IMAGE_UPLOAD,
  ADMIN_PRODUCT_IMAGE_VARIANT,
  ADMIN_PRODUCT_IMAGES,
  ADMIN_PRODUCT_IMAGES_EMPTY_BODY,
  ADMIN_PRODUCT_IMAGES_EMPTY_TITLE,
  ADMIN_PRODUCT_IMAGES_SAVE_FIRST,
  ADMIN_PRODUCT_UPLOAD_FAILED,
  ADMIN_PRODUCTS_RETRY,
} from "@/lib/admin-copy";
import styles from "./AdminProducts.module.css";

const idle: AdminProductActionState = { status: "idle" };

export function AdminProductImages({
  productId,
  images,
  variants,
  colourName,
  heading,
  altValues,
  variantValues,
  onAltChange,
  onVariantChange,
}: {
  productId: string | null;
  images: AdminProductImageView[];
  variants: AdminProductVariantView[];
  colourName?: string;
  heading?: string;
  altValues: Record<string, string>;
  variantValues: Record<string, string>;
  onAltChange: (imageId: string, value: string) => void;
  onVariantChange: (imageId: string, value: string) => void;
}) {
  const router = useRouter();
  const [state, upload, pending] = useActionState(uploadAdminProductImageAction, idle);
  const [busy, startBusy] = useTransition();
  const [uploadVariantId, setUploadVariantId] = useState("");
  const title = heading ?? ADMIN_PRODUCT_IMAGES;
  const headingId = colourName
    ? `product-images-${colourName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : "product-images-heading";
  const fileId = `${headingId}-file`;
  const altId = `${headingId}-alt`;

  useEffect(() => {
    if (state.status === "ok" && state.productId) {
      const fileInput = document.getElementById(fileId);
      if (fileInput instanceof HTMLInputElement) {
        fileInput.value = "";
      }
      router.refresh();
      return;
    }
    if (state.committed && state.productId) {
      router.refresh();
    }
  }, [state, router, fileId]);

  function runUpload() {
    if (!productId) {
      return;
    }
    const data = new FormData();
    data.set("productId", productId);
    const fileInput = document.getElementById(fileId);
    const altInput = document.getElementById(altId);
    const variantInput = document.getElementById(`${headingId}-variant`);
    const files = fileInput instanceof HTMLInputElement ? Array.from(fileInput.files ?? []) : [];
    for (const file of files) {
      if (file.size > 0) {
        data.append("image", file);
      }
    }
    data.set("altText", altInput instanceof HTMLInputElement ? altInput.value : "");
    const variantId = variantInput instanceof HTMLSelectElement ? variantInput.value.trim() : "";
    if (variantId) {
      data.set("variantId", variantId);
    }
    upload(data);
  }

  function runImageAction(
    action: (formData: FormData) => Promise<void>,
    imageId: string,
    extra?: Record<string, string>,
  ) {
    if (!productId) {
      return;
    }
    const data = new FormData();
    data.set("productId", productId);
    data.set("imageId", imageId);
    Object.entries(extra ?? {}).forEach(([key, value]) => data.set(key, value));
    startBusy(() => {
      void action(data).then(() => router.refresh());
    });
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      {!productId ? (
        <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_IMAGES_SAVE_FIRST}</p>
      ) : (
        <>
          {images.length === 0 ? (
            <div className={styles.quiet}>
              <p className={`text-micro ${styles.quietTitle}`}>{ADMIN_PRODUCT_IMAGES_EMPTY_TITLE}</p>
              <p className={`text-small ${styles.quietBody}`}>{ADMIN_PRODUCT_IMAGES_EMPTY_BODY}</p>
            </div>
          ) : (
            <>
              <ul className={styles.images}>
                {images.map((image, index) => (
                  <li key={image.id} className={styles.imageCard}>
                    {image.src && image.width && image.height ? (
                      <Image
                        src={image.src}
                        alt={image.altText}
                        width={image.width}
                        height={image.height}
                        sizes="12rem"
                      />
                    ) : (
                      <span className={styles.thumbEmpty} aria-hidden="true" />
                    )}
                    <p className="text-small">
                      {image.isPrimary ? ADMIN_PRODUCT_IMAGE_PRIMARY : image.imageType}
                    </p>
                    <Field
                      id={`image-alt-${image.id}`}
                      name={`imageAlt:${image.id}`}
                      label={ADMIN_PRODUCT_IMAGE_ALT}
                      value={altValues[image.id] ?? image.altText}
                      onChange={(event) => onAltChange(image.id, event.target.value)}
                      form="admin-product-form"
                      autoComplete="off"
                    />
                    <FieldSelect
                      id={`image-variant-${image.id}`}
                      name={`imageVariant:${image.id}`}
                      label={ADMIN_PRODUCT_IMAGE_VARIANT}
                      value={variantValues[image.id] ?? image.variantId ?? ""}
                      onChange={(event) => onVariantChange(image.id, event.target.value)}
                      form="admin-product-form"
                    >
                      <VariantOptions variants={variants} />
                    </FieldSelect>
                    <div className={styles.imageActions}>
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="tertiary"
                          loading={busy}
                          onClick={() => runImageAction(moveAdminProductImageAction, image.id, { direction: "up" })}
                        >
                          {ADMIN_PRODUCT_IMAGE_MOVE_UP}
                        </Button>
                      ) : null}
                      {index < images.length - 1 ? (
                        <Button
                          type="button"
                          variant="tertiary"
                          loading={busy}
                          onClick={() => runImageAction(moveAdminProductImageAction, image.id, { direction: "down" })}
                        >
                          {ADMIN_PRODUCT_IMAGE_MOVE_DOWN}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="tertiary"
                        loading={busy}
                        onClick={() => runImageAction(deleteAdminProductImageAction, image.id)}
                      >
                        {ADMIN_PRODUCT_IMAGE_REMOVE}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.formGrid}>
            <Field
              id={fileId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              label={ADMIN_PRODUCT_IMAGE_FILE}
            />
            <Field id={altId} label={ADMIN_PRODUCT_IMAGE_ALT} autoComplete="off" />
            <FieldSelect
              id={`${headingId}-variant`}
              label={ADMIN_PRODUCT_IMAGE_VARIANT}
              value={uploadVariantId}
              onChange={(event) => setUploadVariantId(event.target.value)}
            >
              <VariantOptions variants={variants} />
            </FieldSelect>
            {state.status === "invalid" || state.status === "error" ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {ADMIN_PRODUCT_UPLOAD_FAILED}. {state.errors?.images || state.message}
              </p>
            ) : null}
            <Button type="button" variant="secondary" loading={pending} onClick={runUpload}>
              {state.status === "error" ? ADMIN_PRODUCTS_RETRY : ADMIN_PRODUCT_IMAGE_UPLOAD}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function VariantOptions({ variants }: { variants: AdminProductVariantView[] }) {
  return (
    <>
      <option value="">{ADMIN_PRODUCT_IMAGE_NONE}</option>
      {variants.map((variant) => (
        <option key={variant.id} value={variant.id}>
          {[variant.colourName, variant.sizeName].filter(Boolean).join(" · ")}
        </option>
      ))}
    </>
  );
}

"use client";

import { useActionState } from "react";
import Image from "next/image";
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
}: {
  productId: string | null;
  images: AdminProductImageView[];
  variants: AdminProductVariantView[];
}) {
  const [state, action, pending] = useActionState(uploadAdminProductImageAction, idle);
  return (
    <section className={styles.section} aria-labelledby="product-images-heading">
      <h2 id="product-images-heading" className={styles.sectionTitle}>
        {ADMIN_PRODUCT_IMAGES}
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
              <input
                type="hidden"
                name="imageOrder"
                form="admin-product-form"
                value={images.map((image) => image.id).join(",")}
              />
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
                      defaultValue={image.altText}
                      form="admin-product-form"
                      autoComplete="off"
                    />
                    <FieldSelect
                      id={`image-variant-${image.id}`}
                      name={`imageVariant:${image.id}`}
                      label={ADMIN_PRODUCT_IMAGE_VARIANT}
                      defaultValue={image.variantId ?? ""}
                      form="admin-product-form"
                    >
                      <option value="">{ADMIN_PRODUCT_IMAGE_NONE}</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.colourName, variant.sizeName].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </FieldSelect>
                    <div className={styles.imageActions}>
                      {index > 0 ? (
                        <form action={moveAdminProductImageAction}>
                          <input type="hidden" name="productId" value={productId} />
                          <input type="hidden" name="imageId" value={image.id} />
                          <input type="hidden" name="direction" value="up" />
                          <Button type="submit" variant="tertiary">
                            {ADMIN_PRODUCT_IMAGE_MOVE_UP}
                          </Button>
                        </form>
                      ) : null}
                      {index < images.length - 1 ? (
                        <form action={moveAdminProductImageAction}>
                          <input type="hidden" name="productId" value={productId} />
                          <input type="hidden" name="imageId" value={image.id} />
                          <input type="hidden" name="direction" value="down" />
                          <Button type="submit" variant="tertiary">
                            {ADMIN_PRODUCT_IMAGE_MOVE_DOWN}
                          </Button>
                        </form>
                      ) : null}
                      <form action={deleteAdminProductImageAction}>
                        <input type="hidden" name="productId" value={productId} />
                        <input type="hidden" name="imageId" value={image.id} />
                        <Button type="submit" variant="tertiary">
                          {ADMIN_PRODUCT_IMAGE_REMOVE}
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form className={styles.formGrid} action={action} encType="multipart/form-data">
            <input type="hidden" name="productId" value={productId} />
            <Field
              id="product-image-file"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              label={ADMIN_PRODUCT_IMAGE_FILE}
            />
            <Field id="product-image-alt" name="altText" label={ADMIN_PRODUCT_IMAGE_ALT} autoComplete="off" />
            <FieldSelect
              id="product-image-variant"
              name="variantId"
              label={ADMIN_PRODUCT_IMAGE_VARIANT}
              defaultValue=""
            >
              <option value="">{ADMIN_PRODUCT_IMAGE_NONE}</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {[variant.colourName, variant.sizeName].filter(Boolean).join(" · ")}
                </option>
              ))}
            </FieldSelect>
            {state.status === "invalid" || state.status === "error" ? (
              <p className={`text-small ${styles.banner}`} role="alert">
                {ADMIN_PRODUCT_UPLOAD_FAILED}. {state.errors?.images || state.message}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" loading={pending}>
              {state.status === "error" ? ADMIN_PRODUCTS_RETRY : ADMIN_PRODUCT_IMAGE_UPLOAD}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}

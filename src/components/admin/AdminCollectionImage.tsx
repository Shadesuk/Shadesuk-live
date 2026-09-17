"use client";

import { useActionState, useEffect, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  deleteAdminCollectionImageAction,
  uploadAdminCollectionImageAction,
  type AdminCollectionActionState,
} from "@/app/admin/collections/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  ADMIN_COLLECTION_IMAGE,
  ADMIN_COLLECTION_IMAGE_FILE,
  ADMIN_COLLECTION_IMAGE_OPTIONAL,
  ADMIN_COLLECTION_IMAGE_REMOVE,
  ADMIN_COLLECTION_IMAGE_UPLOAD,
  ADMIN_COLLECTION_IMAGES_SAVE_FIRST,
  ADMIN_COLLECTION_UPLOAD_FAILED,
  ADMIN_COLLECTIONS_RETRY,
} from "@/lib/admin-copy";
import styles from "./AdminCollections.module.css";

const idle: AdminCollectionActionState = { status: "idle" };

export function AdminCollectionImage({
  collectionId,
  imageSrc,
  name,
}: {
  collectionId: string | null;
  imageSrc: string | null;
  name: string;
}) {
  const router = useRouter();
  const [state, upload, pending] = useActionState(uploadAdminCollectionImageAction, idle);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (state.status === "ok") {
      router.refresh();
    }
  }, [state, router]);

  const uploadFailed = state.status === "error" || state.status === "invalid" || state.status === "forbidden";

  return (
    <section className={styles.section} aria-labelledby="collection-image-heading">
      <h2 id="collection-image-heading" className={styles.sectionTitle}>
        {ADMIN_COLLECTION_IMAGE}
      </h2>
      <p className="text-small">{ADMIN_COLLECTION_IMAGE_OPTIONAL}</p>
      {imageSrc ? (
        <Image src={imageSrc} alt={name} width={480} height={480} className={styles.imagePreview} />
      ) : null}
      {collectionId ? (
        <>
          <form action={upload} className={styles.formGrid}>
            <input type="hidden" name="collectionId" value={collectionId} />
            <Field
              id="collection-image-file"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              label={ADMIN_COLLECTION_IMAGE_FILE}
              error={state.errors?.image}
            />
            <div className={styles.filterActions}>
              <Button type="submit" variant="secondary" loading={pending}>
                {pending ? "Uploading" : ADMIN_COLLECTION_IMAGE_UPLOAD}
              </Button>
              {imageSrc ? (
                <Button
                  type="button"
                  variant="tertiary"
                  loading={busy}
                  onClick={() => {
                    const data = new FormData();
                    data.set("collectionId", collectionId);
                    startBusy(async () => {
                      await deleteAdminCollectionImageAction(data);
                      router.refresh();
                    });
                  }}
                >
                  {ADMIN_COLLECTION_IMAGE_REMOVE}
                </Button>
              ) : null}
            </div>
          </form>
          {uploadFailed ? (
            <p className={`text-small ${styles.banner}`} role="alert">
              {ADMIN_COLLECTION_UPLOAD_FAILED}. {state.message ?? ""} {state.status === "error" ? ADMIN_COLLECTIONS_RETRY : ""}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-small">{ADMIN_COLLECTION_IMAGES_SAVE_FIRST}</p>
      )}
    </section>
  );
}

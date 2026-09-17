"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAdminCollectionSaveInput } from "@/contracts/admin/collections";
import { sanitizeAdminProductSearch } from "@/contracts/admin/products";
import {
  ADMIN_COLLECTION_SAVE_FAILED_BODY,
  ADMIN_COLLECTION_STALE,
  ADMIN_FORBIDDEN,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { adminCollectionPath, collectionPath, routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  archiveAdminCollection,
  deleteAdminCollection,
  deleteAdminCollectionImage,
  saveAdminCollection,
  searchAssignableCollectionProducts,
  uploadAdminCollectionImage,
  type AdminCollectionMutationResult,
} from "@/services/admin-collections";
import type { AdminCollectionProductRef } from "@/contracts/admin/collections";

export type AdminCollectionActionState = {
  status: "idle" | "ok" | "invalid" | "error" | "forbidden" | "stale";
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  collectionId?: string;
};

export type AdminCollectionSearchState = {
  status: "idle" | "ok" | "error" | "forbidden";
  products: AdminCollectionProductRef[];
  message?: string;
};

const idleFailure = (message = ADMIN_COLLECTION_SAVE_FAILED_BODY): AdminCollectionActionState => ({
  status: "error",
  message,
});

export async function saveAdminCollectionAction(
  _prev: AdminCollectionActionState,
  formData: FormData,
): Promise<AdminCollectionActionState> {
  const parsed = parseAdminCollectionSaveInput(formData);
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return { ...idleFailure(), values: parsed.ok ? undefined : parsed.values };
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN, values: parsed.ok ? undefined : parsed.values };
  }
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }
  if (parsed.intent === "archive") {
    const result = await archiveAdminCollection({
      collectionId: parsed.value.id ?? "",
      role: gate.actor.role,
    });
    return finish(result, parsed.value.id, parsed.value.slug);
  }
  if (parsed.intent === "delete") {
    const result = await deleteAdminCollection({
      collectionId: parsed.value.id ?? "",
      role: gate.actor.role,
    });
    if (result.status === "ok") {
      revalidatePath(routes.adminCollections);
      revalidatePath(routes.collections);
      redirect(routes.adminCollections);
    }
    return finish(result, parsed.value.id, parsed.value.slug);
  }
  const result = await saveAdminCollection({
    payload: parsed.value,
    role: gate.actor.role,
  });
  const created = !parsed.value.id && result.status === "ok";
  const finished = finish(
    result,
    result.status === "ok" ? result.collectionId : parsed.value.id,
    parsed.value.slug,
  );
  if (created && result.status === "ok") {
    redirect(adminCollectionPath(result.collectionId));
  }
  return finished;
}

export async function uploadAdminCollectionImageAction(
  _prev: AdminCollectionActionState,
  formData: FormData,
): Promise<AdminCollectionActionState> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return idleFailure();
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN };
  }
  const collectionId = String(formData.get("collectionId") ?? "");
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return { status: "invalid", errors: { image: "Choose an image to upload." } };
  }
  const result = await uploadAdminCollectionImage({ collectionId, file });
  return finish(result, collectionId);
}

export async function deleteAdminCollectionImageAction(formData: FormData): Promise<void> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return;
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return;
  }
  const collectionId = String(formData.get("collectionId") ?? "");
  const result = await deleteAdminCollectionImage({ collectionId });
  if (result.status === "ok") {
    revalidateCollection(collectionId);
  }
}

export async function searchCollectionProductsAction(
  q: string,
  excludeIds: string[],
): Promise<AdminCollectionSearchState> {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", products: [], message: ADMIN_FORBIDDEN };
  }
  const result = await searchAssignableCollectionProducts({
    q: sanitizeAdminProductSearch(q),
    excludeIds,
    role: gate.actor.role,
  });
  if (result.status === "ok") {
    return { status: "ok", products: result.products };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", products: [], message: ADMIN_FORBIDDEN };
  }
  return { status: "error", products: [], message: ADMIN_COLLECTION_SAVE_FAILED_BODY };
}

function finish(
  result: AdminCollectionMutationResult,
  collectionId: string | null | undefined,
  slug?: string,
): AdminCollectionActionState {
  if (result.status === "ok") {
    revalidateCollection(result.collectionId, slug);
    return { status: "ok", collectionId: result.collectionId };
  }
  if (result.status === "invalid") {
    return {
      status: "invalid",
      errors: result.errors,
      message: Object.values(result.errors)[0],
    };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN };
  }
  if (result.status === "stale") {
    return { status: "stale", message: ADMIN_COLLECTION_STALE };
  }
  if (result.status === "not_found") {
    return { status: "error", message: ADMIN_COLLECTION_SAVE_FAILED_BODY };
  }
  return { status: "error", message: result.message ?? ADMIN_COLLECTION_SAVE_FAILED_BODY };
}

function revalidateCollection(collectionId: string, slug?: string) {
  revalidatePath(routes.adminCollections);
  if (collectionId) {
    revalidatePath(adminCollectionPath(collectionId));
  }
  revalidatePath(routes.collections);
  if (slug) {
    revalidatePath(collectionPath(slug));
  }
}

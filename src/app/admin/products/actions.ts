"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseAdminProductSaveInput,
  type AdminProductIntent,
} from "@/contracts/admin/products";
import {
  ADMIN_FORBIDDEN,
  ADMIN_PRODUCT_SAVE_FAILED_BODY,
  ADMIN_PRODUCT_STALE,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { adminProductPath, productPath, routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  archiveAdminProduct,
  deleteAdminProduct,
  deleteAdminProductImage,
  moveAdminProductImage,
  saveAdminProduct,
  uploadAdminProductImage,
  type AdminProductMutationResult,
} from "@/services/admin-products";

export type AdminProductActionState = {
  status: "idle" | "ok" | "invalid" | "error" | "forbidden" | "stale";
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  productId?: string;
};

const idleFailure = (message = ADMIN_PRODUCT_SAVE_FAILED_BODY): AdminProductActionState => ({
  status: "error",
  message,
});

export async function saveAdminProductAction(
  _prev: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  const parsed = parseAdminProductSaveInput(formData);
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
    const result = await archiveAdminProduct({ productId: parsed.value.id ?? "", role: gate.actor.role });
    return finish(result, parsed.value.id, parsed.value.slug);
  }
  if (parsed.intent === "delete") {
    const result = await deleteAdminProduct({ productId: parsed.value.id ?? "", role: gate.actor.role });
    if (result.status === "ok") {
      revalidatePath(routes.adminProducts);
      revalidatePath(routes.admin);
      redirect(routes.adminProducts);
    }
    return finish(result, parsed.value.id, parsed.value.slug);
  }
  const result = await saveAdminProduct({
    payload: parsed.value,
    intent: parsed.intent as "save" | "publish" | "unpublish",
    role: gate.actor.role,
  });
  const created = !parsed.value.id && result.status === "ok";
  const finished = finish(result, result.status === "ok" ? result.productId : parsed.value.id, parsed.value.slug);
  if (created && result.status === "ok") {
    redirect(adminProductPath(result.productId));
  }
  return finished;
}

export async function uploadAdminProductImageAction(
  _prev: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return idleFailure();
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN };
  }
  const productId = String(formData.get("productId") ?? "");
  const altText = String(formData.get("altText") ?? "");
  const variantIdRaw = String(formData.get("variantId") ?? "");
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return { status: "invalid", errors: { images: "Choose an image to upload." } };
  }
  const result = await uploadAdminProductImage({
    productId,
    file,
    altText,
    variantId: variantIdRaw || null,
  });
  return finish(result, productId);
}

export async function deleteAdminProductImageAction(formData: FormData): Promise<void> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return;
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return;
  }
  const productId = String(formData.get("productId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  const result = await deleteAdminProductImage({ productId, imageId });
  if (result.status === "ok") {
    revalidateProduct(productId);
  }
}

export async function moveAdminProductImageAction(formData: FormData): Promise<void> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return;
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return;
  }
  const productId = String(formData.get("productId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  const result = await moveAdminProductImage({ productId, imageId, direction });
  if (result.status === "ok") {
    revalidateProduct(productId);
  }
}

function finish(
  result: AdminProductMutationResult,
  _productId: string | null | undefined,
  slug?: string,
): AdminProductActionState {
  if (result.status === "ok") {
    revalidateProduct(result.productId, slug);
    return { status: "ok", productId: result.productId };
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
    return { status: "stale", message: ADMIN_PRODUCT_STALE };
  }
  if (result.status === "not_found") {
    return { status: "error", message: ADMIN_PRODUCT_SAVE_FAILED_BODY };
  }
  return { status: "error", message: result.message ?? ADMIN_PRODUCT_SAVE_FAILED_BODY };
}

function revalidateProduct(productId: string, slug?: string) {
  revalidatePath(routes.adminProducts);
  revalidatePath(routes.admin);
  if (productId) {
    revalidatePath(adminProductPath(productId));
  }
  if (slug) {
    revalidatePath(productPath(slug));
    revalidatePath(routes.shop);
    revalidatePath(routes.home);
    revalidatePath(routes.newArrivals);
    revalidatePath(routes.bestSellers);
  }
}

export type { AdminProductIntent };

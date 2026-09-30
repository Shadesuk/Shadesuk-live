"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseAdminProductSaveInput,
  type AdminProductDetailView,
  type AdminProductIntent,
} from "@/contracts/admin/products";
import {
  ADMIN_FORBIDDEN,
  ADMIN_PRODUCT_PUBLISH_BLOCKED,
  ADMIN_PRODUCT_SAVE_FAILED_BODY,
  ADMIN_PRODUCT_STALE,
} from "@/lib/admin-copy";
import { adminProductImageFiles } from "@/lib/admin-product-image-files";
import { getAdminGate } from "@/lib/admin-session";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { adminProductPath, productPath, routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  archiveAdminProduct,
  deleteAdminProduct,
  deleteAdminProductImage,
  moveAdminProductImage,
  publishAdminProduct,
  saveAdminProduct,
  unpublishAdminProduct,
  uploadAdminProductImage,
  type AdminProductMutationResult,
} from "@/services/admin-products";

export type AdminProductActionState = {
  status: "idle" | "ok" | "published" | "invalid" | "error" | "forbidden" | "stale";
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  productId?: string;
  detail?: AdminProductDetailView;
  committed?: boolean;
  intent?: AdminProductIntent;
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
    return finish(result, parsed.value.id, parsed.value.slug, parsed.intent);
  }
  if (parsed.intent === "delete") {
    const result = await deleteAdminProduct({ productId: parsed.value.id ?? "", role: gate.actor.role });
    if (result.status === "ok") {
      revalidatePath(routes.adminProducts);
      revalidatePath(routes.admin);
      redirect(routes.adminProducts);
    }
    return finish(result, parsed.value.id, parsed.value.slug, parsed.intent);
  }
  const result =
    parsed.intent === "publish"
      ? await publishAdminProduct({ payload: parsed.value, role: gate.actor.role })
      : parsed.intent === "unpublish"
        ? await unpublishAdminProduct({ payload: parsed.value, role: gate.actor.role })
        : await saveAdminProduct({ payload: parsed.value, role: gate.actor.role });
  const resultId = "productId" in result ? result.productId : undefined;
  const created = !parsed.value.id && Boolean(resultId);
  const finished = finish(result, resultId ?? parsed.value.id, parsed.value.slug, parsed.intent);
  const committed = "committed" in result && result.committed === true;
  if (created && resultId && (result.status === "ok" || result.status === "published" || committed)) {
    const notice = result.status === "invalid" ? "?notice=publish" : "";
    redirect(`${adminProductPath(resultId)}${notice}`);
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
  const variantId = String(formData.get("variantId") ?? "").trim() || null;
  const files = adminProductImageFiles(formData);
  if (files.length === 0) {
    return { status: "invalid", errors: { images: "Choose an image to upload." } };
  }
  let saved = false;
  let result: AdminProductMutationResult = { status: "error" };
  for (const file of files) {
    result = await uploadAdminProductImage({
      productId,
      file,
      altText,
      variantId,
    });
    if (result.status !== "ok") {
      if (saved) {
        revalidateProduct(productId);
        return {
          status: "error",
          committed: true,
          productId,
          message: "Some images were saved. This file was not attached, and the product was not published.",
        };
      }
      if (result.status === "invalid") {
        return { status: "invalid", errors: result.errors, message: result.errors.images };
      }
      if (result.status === "forbidden") {
        return { status: "forbidden", message: ADMIN_FORBIDDEN };
      }
      return {
        status: "error",
        message: result.status === "error" ? result.message ?? "The image was not saved." : "The image was not saved.",
      };
    }
    saved = true;
  }
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
  intent?: AdminProductIntent,
): AdminProductActionState {
  if (result.status === "ok" || result.status === "published") {
    revalidateProduct(result.productId, slug);
    return {
      status: result.status,
      productId: result.productId,
      detail: result.detail,
      intent,
    };
  }
  if (result.status === "invalid") {
    if (result.committed && result.productId) {
      revalidateProduct(result.productId, slug);
    }
    return {
      status: "invalid",
      errors: result.errors,
      message: result.committed ? ADMIN_PRODUCT_PUBLISH_BLOCKED : Object.values(result.errors)[0],
      detail: result.detail,
      committed: result.committed,
      productId: result.productId,
      intent,
    };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN, intent };
  }
  if (result.status === "stale") {
    return { status: "stale", message: ADMIN_PRODUCT_STALE, intent };
  }
  if (result.status === "not_found") {
    return { status: "error", message: ADMIN_PRODUCT_SAVE_FAILED_BODY, intent };
  }
  if (result.committed && result.productId) {
    revalidateProduct(result.productId, slug);
  }
  return {
    status: "error",
    committed: result.committed,
    productId: result.productId,
    message: result.committed
      ? result.message ?? "The product was saved, but the last step did not finish."
      : result.message ?? ADMIN_PRODUCT_SAVE_FAILED_BODY,
    intent,
  };
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

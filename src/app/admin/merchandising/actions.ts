"use server";

import { revalidatePath } from "next/cache";
import { parseAdminMerchandisingSaveInput, parseMerchandisingSearch } from "@/contracts/admin/merchandising";
import {
  ADMIN_FORBIDDEN,
  ADMIN_MERCHANDISING_FORBIDDEN,
  ADMIN_MERCHANDISING_SAVE_FAILED_BODY,
} from "@/lib/admin-copy";
import { getAdminGate } from "@/lib/admin-session";
import { canAccessMerchandising } from "@/contracts/admin/roles";
import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { routes } from "@/lib/navigation";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  saveAdminMerchandising,
  searchPublishedProductsForMerchandising,
} from "@/services/admin-merchandising";
import type { AdminMerchandisingProductRef } from "@/contracts/admin/merchandising";

export type AdminMerchandisingActionState = {
  status: "idle" | "ok" | "invalid" | "error" | "forbidden";
  message?: string;
};

export type AdminMerchandisingSearchState = {
  status: "idle" | "ok" | "error" | "forbidden";
  products: AdminMerchandisingProductRef[];
  message?: string;
};

export async function saveAdminMerchandisingAction(
  _prev: AdminMerchandisingActionState,
  formData: FormData,
): Promise<AdminMerchandisingActionState> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(Object.fromEntries(formData))) {
    return { status: "error", message: ADMIN_MERCHANDISING_SAVE_FAILED_BODY };
  }
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", message: ADMIN_FORBIDDEN };
  }
  if (!canAccessMerchandising(gate.actor.role)) {
    return { status: "forbidden", message: ADMIN_MERCHANDISING_FORBIDDEN };
  }
  const parsed = parseAdminMerchandisingSaveInput(formData);
  if (!parsed.ok) {
    return { status: "invalid", message: parsed.message };
  }
  const result = await saveAdminMerchandising({ payload: parsed.value, role: gate.actor.role });
  if (result.status === "ok") {
    revalidatePath(routes.adminMerchandising);
    revalidatePath(routes.home);
    revalidatePath(routes.shop);
    revalidatePath(routes.newArrivals);
    revalidatePath(routes.bestSellers);
    revalidatePath(routes.adminProducts);
    return { status: "ok" };
  }
  if (result.status === "invalid") {
    return { status: "invalid", message: result.message };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", message: ADMIN_MERCHANDISING_FORBIDDEN };
  }
  return { status: "error", message: ADMIN_MERCHANDISING_SAVE_FAILED_BODY };
}

export async function searchMerchandisingProductsAction(
  q: string,
  excludeIds: string[],
): Promise<AdminMerchandisingSearchState> {
  const gate = await getAdminGate();
  if (gate.status !== "ok") {
    return { status: "forbidden", products: [], message: ADMIN_FORBIDDEN };
  }
  if (!canAccessMerchandising(gate.actor.role)) {
    return { status: "forbidden", products: [], message: ADMIN_MERCHANDISING_FORBIDDEN };
  }
  const result = await searchPublishedProductsForMerchandising({
    q: parseMerchandisingSearch(q),
    excludeIds,
    role: gate.actor.role,
  });
  if (result.status === "ok") {
    return { status: "ok", products: result.products };
  }
  if (result.status === "forbidden") {
    return { status: "forbidden", products: [], message: ADMIN_MERCHANDISING_FORBIDDEN };
  }
  return { status: "error", products: [], message: ADMIN_MERCHANDISING_SAVE_FAILED_BODY };
}

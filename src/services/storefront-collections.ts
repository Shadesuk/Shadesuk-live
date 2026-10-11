import "server-only";

import { cache } from "react";
import type { CollectionDefinition } from "@/types/collection";
import type { Product } from "@/types/catalogue";
import { collectionPath } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isCollectionSlug } from "@/contracts/admin/collections";

export type AssignedStorefrontCollection = CollectionDefinition & {
  kind: "assigned";
  productIds: string[];
  updatedAt?: string;
};

function toAssignedCollection(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productIds: string[];
  updatedAt?: string | null;
}): AssignedStorefrontCollection {
  return {
    id: row.id,
    slug: row.slug,
    href: collectionPath(row.slug),
    title: row.name,
    description: row.description?.trim() || undefined,
    kind: "assigned",
    productIds: row.productIds,
    ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
  };
}

export const loadPublishedAssignedCollection = cache(async function loadPublishedAssignedCollection(
  slug: string,
): Promise<AssignedStorefrontCollection | null> {
  const trimmed = slug.trim();
  if (!trimmed || !isCollectionSlug(trimmed) || !isSupabaseConfigured()) {
    return null;
  }
  try {
    const supabase = createSupabasePublicClient();
    const collection = await supabase
      .from("collections")
      .select("id, slug, name, description, status, updated_at")
      .eq("slug", trimmed)
      .eq("status", "published")
      .maybeSingle();
    if (collection.error || !collection.data || typeof collection.data.id !== "string") {
      return null;
    }
    const links = await supabase
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", collection.data.id);
    if (links.error) {
      return null;
    }
    const productIds = (Array.isArray(links.data) ? links.data : [])
      .map((row) => (row && typeof row.product_id === "string" ? row.product_id : ""))
      .filter(Boolean);
    return toAssignedCollection({
      id: collection.data.id,
      slug: collection.data.slug,
      name: collection.data.name,
      description: typeof collection.data.description === "string" ? collection.data.description : null,
      productIds,
      updatedAt: typeof collection.data.updated_at === "string" ? collection.data.updated_at : null,
    });
  } catch {
    return null;
  }
});

export const listPublishedAssignedCollections = cache(async function listPublishedAssignedCollections(
  products: Product[],
): Promise<AssignedStorefrontCollection[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  try {
    const supabase = createSupabasePublicClient();
    const collections = await supabase
      .from("collections")
      .select("id, slug, name, description, status, sort_order, updated_at")
      .eq("status", "published")
      .order("sort_order")
      .order("name");
    if (collections.error) {
      return [];
    }
    const rows = Array.isArray(collections.data) ? collections.data : [];
    const ids = rows.map((row) => (row && typeof row.id === "string" ? row.id : "")).filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const links = await supabase.from("product_collections").select("product_id, collection_id").in("collection_id", ids);
    if (links.error) {
      return [];
    }
    const liveIds = new Set(products.map((product) => product.id));
    const byCollection = new Map<string, string[]>();
    for (const row of Array.isArray(links.data) ? links.data : []) {
      if (!row || typeof row.collection_id !== "string" || typeof row.product_id !== "string") {
        continue;
      }
      if (!liveIds.has(row.product_id)) {
        continue;
      }
      const current = byCollection.get(row.collection_id) ?? [];
      current.push(row.product_id);
      byCollection.set(row.collection_id, current);
    }
    return rows.flatMap((row) => {
      if (
        !row ||
        typeof row.id !== "string" ||
        typeof row.slug !== "string" ||
        typeof row.name !== "string"
      ) {
        return [];
      }
      const productIds = byCollection.get(row.id) ?? [];
      if (productIds.length === 0) {
        return [];
      }
      return [
        toAssignedCollection({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: typeof row.description === "string" ? row.description : null,
          productIds,
          updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
        }),
      ];
    });
  } catch {
    return [];
  }
});

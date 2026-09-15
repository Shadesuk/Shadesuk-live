import { cache } from "react";
import "server-only";

import type { MappedStorefrontProduct } from "@/contracts";
import { evaluateAddToBag, parseAddToBagInput } from "@/lib/add-to-bag";
import { getBrandName, getProductBySlug, getProducts } from "@/services/catalogue";
import {
  fetchLiveProductBySlug,
  fetchLiveProductsByIds,
  fetchLiveRelatedProducts,
} from "@/services/live-catalogue";
import type { AddToBagInput, AddToBagResult, ProductDataSource } from "@/types/pdp";

export type StorefrontProductRecord = {
  source: ProductDataSource;
  product: MappedStorefrontProduct;
  brandName: string;
};

export type StorefrontProductPage = StorefrontProductRecord & {
  related: MappedStorefrontProduct[];
};

export const getStorefrontProductBySlug = cache(
  async function getStorefrontProductBySlug(
    slug: string,
  ): Promise<StorefrontProductRecord | null> {
    const trimmed = slug.trim();
    if (!trimmed) {
      return null;
    }

    const live = await fetchLiveProductBySlug(trimmed, "pdp");
    if (live) {
      return {
        source: "live",
        product: live.product,
        brandName: live.brandName,
      };
    }

    const demo = getProductBySlug(trimmed);
    if (!demo) {
      return null;
    }

    return {
      source: "demo",
      product: demo,
      brandName: getBrandName(demo),
    };
  },
);

export const getStorefrontProductPage = cache(
  async function getStorefrontProductPage(
    slug: string,
  ): Promise<StorefrontProductPage | null> {
    const record = await getStorefrontProductBySlug(slug);
    if (!record) {
      return null;
    }

    return {
      ...record,
      related: await getRelatedProducts(record),
    };
  },
);

export async function getStorefrontProductsByIds(
  ids: string[],
): Promise<MappedStorefrontProduct[]> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))].slice(
    0,
    4,
  );
  if (unique.length === 0) {
    return [];
  }

  const demoById = new Map(
    getProducts()
      .filter((product) => unique.includes(product.id))
      .map((product) => [product.id, product]),
  );
  const missing = unique.filter((id) => !demoById.has(id));
  const live = await fetchLiveProductsByIds(missing, "card");
  const liveById = new Map(live.map((product) => [product.id, product]));

  return unique
    .map((id) => demoById.get(id) ?? liveById.get(id))
    .filter((product): product is MappedStorefrontProduct => Boolean(product));
}

export async function prepareAddToBag(input: AddToBagInput): Promise<AddToBagResult> {
  const parsed = parseAddToBagInput(input);
  if (!parsed) {
    return { status: "error" };
  }
  const record = await getStorefrontProductBySlug(parsed.slug);
  return evaluateAddToBag(record?.product, parsed);
}

async function getRelatedProducts(
  record: StorefrontProductRecord,
): Promise<MappedStorefrontProduct[]> {
  if (record.source === "live") {
    return fetchLiveRelatedProducts(record.product);
  }

  const shape = record.product.shape[0];
  if (!shape) {
    return [];
  }

  return getProducts()
    .filter(
      (product) => product.id !== record.product.id && product.shape.includes(shape),
    )
    .slice(0, 4);
}

import type { MetadataRoute } from "next";
import { INFO_PAGES } from "@/lib/legal-copy";
import { brandPath, productPath, routes } from "@/lib/navigation";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";
import { getCollections } from "@/services/collections";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const catalogue = await getStorefrontCatalogue();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: site.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...[
      routes.shop,
      routes.men,
      routes.women,
      routes.unisex,
      routes.newArrivals,
      routes.bestSellers,
      routes.collections,
      routes.brands,
    ].map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...getCollections()
      .filter((collection) => collection.kind === "shape")
      .map((collection) => ({
        url: absoluteUrl(collection.href),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...INFO_PAGES.map((page) => ({
      url: absoluteUrl(page.href),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];

  if (catalogue.source !== "live") {
    return staticRoutes;
  }

  const brands = catalogue.brands
    .filter((brand) => brand.status === "active")
    .map((brand) => ({
      url: absoluteUrl(brandPath(brand.slug)),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const products = catalogue.products.map((product) => ({
    url: absoluteUrl(productPath(product.slug)),
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...brands, ...products];
}

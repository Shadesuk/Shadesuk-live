import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/seo";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}

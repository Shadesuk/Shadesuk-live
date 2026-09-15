import { NextResponse } from "next/server";
import { clampSearchQuery } from "@/lib/search-query";
import { getSearchSuggestions } from "@/services/search";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

export const dynamic = "force-dynamic";

/**
 * Suggestion slice only. Does not return the catalogue. Uses the published
 * storefront snapshot (anon RLS) — never the service-role client.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("q") ?? "";
  const query = clampSearchQuery(raw);
  if (!query) {
    return NextResponse.json(
      { suggestions: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const catalogue = await getStorefrontCatalogue();
  if (catalogue.unavailable) {
    return NextResponse.json(
      { suggestions: [] },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const suggestions = getSearchSuggestions(query, {
    products: catalogue.products,
    brands: catalogue.brands,
  });

  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

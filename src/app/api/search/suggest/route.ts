import { NextResponse } from "next/server";
import { clientAddressFromHeaders } from "@/lib/request-address";
import {
  SEARCH_SUGGEST_RETRY_AFTER_SECONDS,
  searchSuggestAttemptAllowed,
} from "@/lib/search-suggest-limit";
import { clampSearchQuery } from "@/lib/search-query";
import { getSearchSuggestions } from "@/services/search";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Suggestion slice only. Does not return the catalogue. Uses the published
 * storefront snapshot (anon RLS) — never the service-role client.
 *
 * The live snapshot is process-cached (see fetchLivePublishedCatalogue) so
 * this handler does not re-page ≤2000 published rows on every keystroke.
 */
export async function GET(request: Request) {
  const ip = clientAddressFromHeaders(request.headers);
  if (!searchSuggestAttemptAllowed(ip)) {
    return NextResponse.json(
      { suggestions: [] },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(SEARCH_SUGGEST_RETRY_AFTER_SECONDS),
        },
      },
    );
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("q") ?? "";
  const query = clampSearchQuery(raw);
  if (!query) {
    return NextResponse.json({ suggestions: [] }, { headers: NO_STORE });
  }

  const catalogue = await getStorefrontCatalogue();
  if (catalogue.unavailable) {
    return NextResponse.json(
      { suggestions: [] },
      {
        status: 503,
        headers: NO_STORE,
      },
    );
  }

  const suggestions = getSearchSuggestions(query, {
    products: catalogue.products,
    brands: catalogue.brands,
  });

  return NextResponse.json({ suggestions }, { headers: NO_STORE });
}

import "server-only";

import { headers } from "next/headers";
import { isAllowedCartActionOrigin } from "@/lib/cart-origin";
import { site } from "@/lib/site";

export async function cartActionOriginAllowed(): Promise<boolean> {
  const requestHeaders = await headers();
  return isAllowedCartActionOrigin({
    origin: requestHeaders.get("origin"),
    referer: requestHeaders.get("referer"),
    host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    siteUrl: site.url,
  });
}

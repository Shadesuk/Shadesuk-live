"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { registerAnalyticsProvider, track } from "@/lib/analytics";
import { hasAdvertisingConsent, subscribeCookieConsent } from "@/lib/cookie-consent";
import {
  disableMetaPixelTracking,
  enableMetaPixel,
  metaPixelAnalyticsProvider,
  readMetaPixelId,
} from "@/lib/meta-pixel";

/**
 * Loads the Meta Pixel at most once, only after advertising/analytics consent.
 * Route-change PageViews stay on AnalyticsPageView so this file does not double-fire them.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const path = search ? `${pathname}?${search}` : pathname;
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    let cancelled = false;

    function applyConsent() {
      if (!readMetaPixelId() || !hasAdvertisingConsent()) {
        disableMetaPixelTracking();
        return;
      }
      void enableMetaPixel().then((ready) => {
        if (cancelled || !ready || !hasAdvertisingConsent()) {
          return;
        }
        registerAnalyticsProvider(metaPixelAnalyticsProvider);
        track("page_view", { path: pathRef.current });
      });
    }

    applyConsent();
    return subscribeCookieConsent(applyConsent);
  }, []);

  return null;
}

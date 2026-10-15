"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    let cancelled = false;

    function currentPath(): string {
      return `${window.location.pathname}${window.location.search}`;
    }

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
        track("page_view", { path: currentPath() });
      });
    }

    applyConsent();
    const unsubscribe = subscribeCookieConsent(applyConsent);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}

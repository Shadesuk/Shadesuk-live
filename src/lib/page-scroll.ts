"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Keep the viewport at the top of a stepped or replaced page.
 * Browser scroll anchoring and App Router scroll restoration otherwise
 * leave the shopper on the control they just pressed (the payment CTA).
 */
export function PinPageStart({ focusId }: { focusId: string }) {
  usePinPageStart("page-start", focusId);
  return null;
}

function pinPageStart(focusId: string) {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.getElementById(focusId)?.focus({ preventScroll: true });
}

export function usePinPageStart(key: string, focusId: string, skipFirst = false) {
  const isFirst = useRef(true);
  const shouldPin = useRef(false);

  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const skip = skipFirst && isFirst.current;
    isFirst.current = false;
    shouldPin.current = !skip;
    if (!skip) {
      pinPageStart(focusId);
    }
    return () => {
      history.scrollRestoration = previous;
    };
  }, [key, focusId, skipFirst]);

  useEffect(() => {
    if (!shouldPin.current) {
      return;
    }
    pinPageStart(focusId);
  }, [key, focusId]);
}

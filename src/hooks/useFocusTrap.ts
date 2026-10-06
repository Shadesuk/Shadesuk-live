"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex !== -1 &&
      element.getClientRects().length > 0,
  );
}

export function useFocusTrap(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onEscape: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const onEscapeRef = useRef(onEscape);
  const restoreFrame = useRef(0);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelAnimationFrame(restoreFrame.current);

    const root = ref.current;
    if (!root) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = getFocusable(root);
    const preferred = initialFocus?.current;
    const start = preferred && root.contains(preferred) ? preferred : (focusable[0] ?? root);
    start.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (event.key !== "Tab" || !root) {
        return;
      }

      const items = getFocusable(root);
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = previouslyFocused;
      // The page can still be inert in this cleanup. Focus after the overlay
      // has released it, and cancel that restore if the dialog opens again.
      restoreFrame.current = requestAnimationFrame(() => {
        restoreFrame.current = requestAnimationFrame(() => {
          if (target?.isConnected) {
            target.focus();
          }
        });
      });
    };
  }, [open, ref, initialFocus]);
}

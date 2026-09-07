"use client";

import { createContext, useContext, type ReactNode } from "react";

type ChromeContextValue = {
  setPageLocked: (locked: boolean) => void;
};

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function useChrome() {
  const value = useContext(ChromeContext);
  if (!value) {
    throw new Error("useChrome must be used within SiteChrome");
  }
  return value;
}

export function ChromeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ChromeContextValue;
}) {
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

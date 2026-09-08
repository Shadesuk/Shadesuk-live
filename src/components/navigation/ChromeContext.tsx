"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ChromeContextValue = {
  acquirePageLock: () => void;
  releasePageLock: () => void;
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

export function useChromeLocks(): {
  pageLocked: boolean;
  value: ChromeContextValue;
} {
  const [lockCount, setLockCount] = useState(0);
  const acquirePageLock = useCallback(() => {
    setLockCount((count) => count + 1);
  }, []);
  const releasePageLock = useCallback(() => {
    setLockCount((count) => Math.max(0, count - 1));
  }, []);
  const value = useMemo(
    () => ({ acquirePageLock, releasePageLock }),
    [acquirePageLock, releasePageLock],
  );
  return { pageLocked: lockCount > 0, value };
}

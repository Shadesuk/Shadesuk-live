"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    track("page_view", { path: search ? `${pathname}?${search}` : pathname });
  }, [pathname, search]);

  return null;
}

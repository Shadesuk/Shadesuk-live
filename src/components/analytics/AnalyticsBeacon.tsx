"use client";

import { useEffect } from "react";
import { track, type AnalyticsEventName, type AnalyticsPayload } from "@/lib/analytics";

export function AnalyticsBeacon({
  event,
  payload,
}: {
  event: AnalyticsEventName;
  payload?: AnalyticsPayload;
}) {
  const serialized = JSON.stringify(payload ?? {});

  useEffect(() => {
    track(event, JSON.parse(serialized) as AnalyticsPayload);
  }, [event, serialized]);

  return null;
}

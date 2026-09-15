import type { GuestOrderTrackingView } from "@/contracts";

export type GuestTrackingActionResult =
  | { status: "ok"; order: GuestOrderTrackingView }
  | { status: "not_found"; message: string }
  | { status: "rate_limited"; message: string }
  | { status: "error"; message: string };

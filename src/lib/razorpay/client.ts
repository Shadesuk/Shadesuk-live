import "server-only";

import Razorpay from "razorpay";
import { resolveRazorpayServerConfig, type RazorpayServerConfig } from "./config";

export type RazorpayClientResult =
  | { ok: true; client: Razorpay; config: RazorpayServerConfig }
  | { ok: false; issues: string[] };

let cached: { keyId: string; keySecret: string; client: Razorpay } | null = null;

/**
 * Lazily constructs the official Razorpay Node SDK client.
 * Key secret never leaves this server-only module.
 */
export function getRazorpayClient(): RazorpayClientResult {
  const resolved = resolveRazorpayServerConfig();
  if (!resolved.ok) {
    return resolved;
  }
  const { config } = resolved;
  if (
    !cached ||
    cached.keyId !== config.keyId ||
    cached.keySecret !== config.keySecret
  ) {
    cached = {
      keyId: config.keyId,
      keySecret: config.keySecret,
      client: new Razorpay({
        key_id: config.keyId,
        key_secret: config.keySecret,
      }),
    };
  }
  return { ok: true, client: cached.client, config };
}

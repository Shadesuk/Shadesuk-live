import "server-only";

import { Resend } from "resend";
import { resolveResendConfig, type ResendConfig } from "./config";

let cached: { apiKey: string; client: Resend } | null = null;

export type ResendClientResult =
  | { ok: true; client: Resend; config: ResendConfig }
  | { ok: false; issues: string[] };

/**
 * Lazily constructs the official Resend SDK client. The API key never leaves
 * this server-only module.
 */
export function getResendClient(): ResendClientResult {
  const resolved = resolveResendConfig();
  if (!resolved.ok) {
    return resolved;
  }

  const { config } = resolved;
  if (!cached || cached.apiKey !== config.apiKey) {
    cached = { apiKey: config.apiKey, client: new Resend(config.apiKey) };
  }

  return { ok: true, client: cached.client, config };
}

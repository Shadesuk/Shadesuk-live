import "server-only";

/**
 * Server-only PayPal credentials. Never prefix secrets with `NEXT_PUBLIC_`.
 * Client ID is public and returned from the initiation Server Action —
 * do not add NEXT_PUBLIC_PAYPAL_CLIENT_SECRET.
 */

export type PayPalMode = "sandbox" | "live";

export type PayPalServerConfig = {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
  apiBaseUrl: string;
};

export type PayPalServerConfigResult =
  | { ok: true; config: PayPalServerConfig }
  | { ok: false; issues: string[] };

export type PayPalWebhookIdResult =
  | { ok: true; webhookId: string }
  | { ok: false; issues: string[] };

const SANDBOX_API = "https://api-m.sandbox.paypal.com";
const LIVE_API = "https://api-m.paypal.com";

function readEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function resolvePayPalMode(raw?: string): PayPalMode | null {
  const mode = (raw ?? process.env.PAYPAL_MODE)?.trim().toLowerCase();
  if (mode === "sandbox" || mode === "live") {
    return mode;
  }
  return null;
}

export function paypalApiBaseUrl(mode: PayPalMode): string {
  return mode === "live" ? LIVE_API : SANDBOX_API;
}

export function resolvePayPalServerConfig(): PayPalServerConfigResult {
  const clientId = readEnv(process.env.PAYPAL_CLIENT_ID);
  const clientSecret = readEnv(process.env.PAYPAL_CLIENT_SECRET);
  const mode = resolvePayPalMode();
  const issues: string[] = [];
  if (!clientId) {
    issues.push("PAYPAL_CLIENT_ID is not set");
  }
  if (!clientSecret) {
    issues.push("PAYPAL_CLIENT_SECRET is not set");
  }
  if (!mode) {
    issues.push("PAYPAL_MODE must be sandbox or live");
  }
  if (issues.length > 0 || !mode) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    config: {
      clientId,
      clientSecret,
      mode,
      apiBaseUrl: paypalApiBaseUrl(mode),
    },
  };
}

export function getPayPalServerConfig(): PayPalServerConfig {
  const resolved = resolvePayPalServerConfig();
  if (!resolved.ok) {
    throw new Error(`PayPal is not configured: ${resolved.issues.join("; ")}.`);
  }
  return resolved.config;
}

/** Required when a webhook handler exists (Phase 4). Not required to create an order. */
export function resolvePayPalWebhookId(): PayPalWebhookIdResult {
  const webhookId = readEnv(process.env.PAYPAL_WEBHOOK_ID);
  if (!webhookId) {
    return { ok: false, issues: ["PAYPAL_WEBHOOK_ID is not set"] };
  }
  return { ok: true, webhookId };
}

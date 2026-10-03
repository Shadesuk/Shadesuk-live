import "server-only";

import {
  resolvePayPalServerConfig,
  type PayPalServerConfig,
} from "./config";
import { paypalFailureMessage, redactPayPalSecrets } from "./errors";

export type PayPalAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

export type PayPalJsonResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; error: string; status?: number; body?: unknown };

/**
 * Orders create may return 201 without purchase_units unless this Prefer is set.
 * Applied on all `paypalFetchJson` callers (create / GET / capture) intentionally.
 */
export const PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION = "return=representation";

type TokenCache = {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  token: PayPalAccessToken;
};

type ClientTokenCache = TokenCache & {
  hosts: string;
};

let tokenCache: TokenCache | null = null;
let clientTokenCache: ClientTokenCache | null = null;

export function paypalClientTokenHosts(origins: readonly string[]): string[] {
  const hosts = new Set<string>();
  for (const value of origins) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
      if (!url.hostname) {
        continue;
      }
      hosts.add(url.port ? `${url.hostname}:${url.port}` : url.hostname);
    } catch {
      // Ignore unparseable origins. The token request still binds to valid hosts.
    }
  }
  return [...hosts];
}

/** Official v6 browser-safe token grant. Not the REST access token used by paypalFetchJson. */
export function buildPayPalClientTokenForm(hosts: readonly string[]): string {
  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  params.set("response_type", "client_token");
  if (hosts.length > 0) {
    params.set("domains[]", hosts.join(","));
  }
  return params.toString();
}

/**
 * OAuth2 client-credentials access token via raw fetch.
 * Client secret never leaves this server-only module.
 */
export async function getPayPalAccessToken(
  config?: PayPalServerConfig,
): Promise<{ ok: true; accessToken: string; config: PayPalServerConfig } | { ok: false; error: string }> {
  const resolved = config
    ? { ok: true as const, config }
    : resolvePayPalServerConfig();
  if (!resolved.ok) {
    return { ok: false, error: "PayPal is not configured." };
  }
  const { config: cfg } = resolved;
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.clientId === cfg.clientId &&
    tokenCache.clientSecret === cfg.clientSecret &&
    tokenCache.apiBaseUrl === cfg.apiBaseUrl &&
    tokenCache.token.expiresAtMs > now + 30_000
  ) {
    return { ok: true, accessToken: tokenCache.token.accessToken, config: cfg };
  }

  try {
    const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    const response = await fetch(`${cfg.apiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body || typeof body.access_token !== "string") {
      return {
        ok: false,
        error: paypalFailureMessage(
          body ?? `PayPal OAuth failed with HTTP ${response.status}.`,
        ),
      };
    }
    const expiresIn =
      typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
        ? body.expires_in
        : 300;
    const token: PayPalAccessToken = {
      accessToken: body.access_token,
      expiresAtMs: now + Math.max(60, expiresIn) * 1000,
    };
    tokenCache = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      apiBaseUrl: cfg.apiBaseUrl,
      token,
    };
    return { ok: true, accessToken: token.accessToken, config: cfg };
  } catch (error) {
    return { ok: false, error: paypalFailureMessage(error) };
  }
}

/**
 * Browser-safe JS SDK v6 client token. Bound to checkout hosts.
 * Never log the token. Never return CLIENT_SECRET.
 */
export async function getPayPalBrowserClientToken(
  hosts: readonly string[],
  config?: PayPalServerConfig,
): Promise<{ ok: true; clientToken: string } | { ok: false; error: string }> {
  const resolved = config
    ? { ok: true as const, config }
    : resolvePayPalServerConfig();
  if (!resolved.ok) {
    return { ok: false, error: "PayPal is not configured." };
  }
  const { config: cfg } = resolved;
  const boundHosts = paypalClientTokenHosts(hosts);
  if (boundHosts.length === 0) {
    return { ok: false, error: "PayPal client token is missing a checkout host." };
  }
  const hostKey = boundHosts.join(",");
  const now = Date.now();
  if (
    clientTokenCache &&
    clientTokenCache.clientId === cfg.clientId &&
    clientTokenCache.clientSecret === cfg.clientSecret &&
    clientTokenCache.apiBaseUrl === cfg.apiBaseUrl &&
    clientTokenCache.hosts === hostKey &&
    clientTokenCache.token.expiresAtMs > now + 30_000
  ) {
    return { ok: true, clientToken: clientTokenCache.token.accessToken };
  }

  try {
    const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    const response = await fetch(`${cfg.apiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: buildPayPalClientTokenForm(boundHosts),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body || typeof body.access_token !== "string" || !body.access_token.trim()) {
      return {
        ok: false,
        error: paypalFailureMessage(
          body ?? `PayPal client-token grant failed with HTTP ${response.status}.`,
        ),
      };
    }
    const expiresIn =
      typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
        ? body.expires_in
        : 900;
    const token: PayPalAccessToken = {
      accessToken: body.access_token.trim(),
      expiresAtMs: now + Math.max(60, expiresIn) * 1000,
    };
    clientTokenCache = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      apiBaseUrl: cfg.apiBaseUrl,
      hosts: hostKey,
      token,
    };
    return { ok: true, clientToken: token.accessToken };
  } catch (error) {
    return { ok: false, error: paypalFailureMessage(error) };
  }
}

export async function paypalFetchJson(input: {
  path: string;
  method: "GET" | "POST" | "PATCH";
  body?: unknown;
  idempotencyKey?: string;
}): Promise<PayPalJsonResult> {
  const auth = await getPayPalAccessToken();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: "application/json",
    // Orders API may omit purchase_units without this Prefer (create returns 201 id-only).
    Prefer: PAYPAL_ORDERS_PREFER_RETURN_REPRESENTATION,
  };
  if (input.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (input.idempotencyKey?.trim()) {
    headers["PayPal-Request-Id"] = input.idempotencyKey.trim();
  }

  try {
    const response = await fetch(`${auth.config.apiBaseUrl}${input.path}`, {
      method: input.method,
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return {
          ok: false,
          error: redactPayPalSecrets(
            `PayPal returned non-JSON (HTTP ${response.status}).`,
          ),
          status: response.status,
        };
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        error: paypalFailureMessage(parsed ?? `PayPal HTTP ${response.status}`),
        status: response.status,
        body: parsed,
      };
    }
    return { ok: true, status: response.status, body: parsed };
  } catch (error) {
    return { ok: false, error: paypalFailureMessage(error) };
  }
}

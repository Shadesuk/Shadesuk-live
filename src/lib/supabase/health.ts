import "server-only";

import { getSupabaseSecretKey, hasSupabaseSecretKey } from "./admin";
import { resolveSupabasePublicConfig } from "./config";

const PROBE_TIMEOUT_MS = 5_000;

export type SupabaseProbeName = "publishableKey" | "secretKey";

export type SupabaseProbeStatus =
  | "ok"
  | "unauthorized"
  | "unexpected_status"
  | "unreachable"
  | "skipped"
  | "skipped_insecure_transport";

export type SupabaseProbe = {
  key: SupabaseProbeName;
  status: SupabaseProbeStatus;
  httpStatus?: number;
};

export type SupabaseConnectionReport = {
  ok: boolean;
  configured: boolean;
  /** Configuration problems, described by variable name only. */
  issues: string[];
  /** Non-blocking gaps, described by variable name only. */
  warnings: string[];
  probes: SupabaseProbe[];
  checkedAt: string;
  durationMs: number;
};

/**
 * The secret key may only be sent over TLS, or to a loopback address where it
 * never leaves the machine. A misconfigured project URL must not become a way to
 * ship the secret to an arbitrary host in the clear.
 */
function allowsSecretTransport(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  if (protocol === "https:") {
    return true;
  }
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Endpoints that verify a key without touching application schema. GoTrue's
 * health endpoint accepts a publishable key, whereas the PostgREST root rejects
 * anything but a secret key ("Only secret API keys can be used for this
 * endpoint") and in exchange proves the API gateway reached Postgres.
 */
const PROBE_PATH: Record<SupabaseProbeName, string> = {
  publishableKey: "/auth/v1/health",
  secretKey: "/rest/v1/",
};

/**
 * Sends the key the only way the gateway authenticates it, as `apikey`. No
 * bearer token is attached: publishable and secret keys are not JWTs, so a
 * misplaced one would be rejected as a malformed session. No key material or
 * response body is ever returned.
 */
async function probeApiKey(
  key: SupabaseProbeName,
  url: string,
  apiKey: string,
): Promise<SupabaseProbe> {
  try {
    const response = await fetch(`${url}${PROBE_PATH[key]}`, {
      headers: { apikey: apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (response.ok) {
      return { key, status: "ok", httpStatus: response.status };
    }
    if (response.status === 401 || response.status === 403) {
      return { key, status: "unauthorized", httpStatus: response.status };
    }
    return { key, status: "unexpected_status", httpStatus: response.status };
  } catch {
    return { key, status: "unreachable" };
  }
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionReport> {
  const startedAt = Date.now();
  const config = resolveSupabasePublicConfig();
  const warnings: string[] = [];

  if (!config.ok) {
    return {
      ok: false,
      configured: false,
      issues: config.issues,
      warnings,
      probes: [],
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };
  }

  const probes: SupabaseProbe[] = [
    await probeApiKey("publishableKey", config.config.url, config.config.publishableKey),
  ];

  if (!hasSupabaseSecretKey()) {
    probes.push({ key: "secretKey", status: "skipped" });
    warnings.push(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set, so server-side privileged access is unavailable",
    );
  } else if (!allowsSecretTransport(config.config.url)) {
    probes.push({ key: "secretKey", status: "skipped_insecure_transport" });
    warnings.push(
      "NEXT_PUBLIC_SUPABASE_URL is plaintext http to a remote host, so the secret key was not sent",
    );
  } else {
    probes.push(
      await probeApiKey("secretKey", config.config.url, getSupabaseSecretKey()),
    );
  }

  return {
    ok: probes.every(
      (probe) => probe.status === "ok" || probe.status === "skipped",
    ),
    configured: true,
    issues: [],
    warnings,
    probes,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

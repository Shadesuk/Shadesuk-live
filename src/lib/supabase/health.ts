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
  | "skipped";

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
 * Verifies the Supabase connection without touching application schema: the
 * PostgREST root only answers once the API gateway has reached Postgres and has
 * accepted the API key. No key material or response body is ever returned.
 */
async function probeRestRoot(
  key: SupabaseProbeName,
  url: string,
  apiKey: string,
): Promise<SupabaseProbe> {
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
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
    await probeRestRoot("publishableKey", config.config.url, config.config.publishableKey),
  ];

  if (hasSupabaseSecretKey()) {
    probes.push(
      await probeRestRoot("secretKey", config.config.url, getSupabaseSecretKey()),
    );
  } else {
    probes.push({ key: "secretKey", status: "skipped" });
    warnings.push(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set, so server-side privileged access is unavailable",
    );
  }

  return {
    ok: probes.every((probe) => probe.status === "ok" || probe.status === "skipped"),
    configured: true,
    issues: [],
    warnings,
    probes,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

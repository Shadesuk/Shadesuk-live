/**
 * Supabase environment resolution.
 *
 * This module is safe to import from browser code: it only ever reads the
 * public project URL and the publishable (anon) key. The service-role secret is
 * read exclusively in `./admin`, which is server-only.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values at build time.
 */

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type SupabasePublicConfigResult =
  | { ok: true; config: SupabasePublicConfig }
  | { ok: false; issues: string[] };

function readEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

function resolveUrl(): string {
  return readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Publishable keys are the current name; anon keys stay supported. */
function resolvePublishableKey(): string {
  return (
    readEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function resolveSupabasePublicConfig(): SupabasePublicConfigResult {
  const url = resolveUrl();
  const publishableKey = resolvePublishableKey();
  const issues: string[] = [];

  if (!url) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  } else if (!isAbsoluteHttpUrl(url)) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL is not an absolute http(s) URL");
  }

  if (!publishableKey) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set",
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, config: { url: url.replace(/\/+$/, ""), publishableKey } };
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const result = resolveSupabasePublicConfig();
  if (!result.ok) {
    throw new Error(`Supabase is not configured: ${result.issues.join("; ")}.`);
  }
  return result.config;
}

export function isSupabaseConfigured(): boolean {
  return resolveSupabasePublicConfig().ok;
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

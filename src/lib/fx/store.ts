import "server-only";

import { CATALOGUE_BASE_CURRENCY } from "@/contracts/markets";
import { parsePositiveDecimalRate } from "@/contracts/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FX_QUOTE_CURRENCIES, type FxQuoteCurrency } from "./observations";
import type { FxRateInsert } from "./refresh";

export type CachedFxRate = {
  id: string;
  version: number;
  quoteCurrency: FxQuoteCurrency;
  rate: string;
  effectiveAt: string;
};

type FxRateRow = {
  id?: unknown;
  quote_currency?: unknown;
  rate?: unknown;
  version?: unknown;
  effective_at?: unknown;
  status?: unknown;
};

export async function insertFxObservations(rows: readonly FxRateInsert[]): Promise<void> {
  if (rows.length === 0) {
    throw new Error("Refusing to insert an empty FX batch.");
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("fx_rates").insert(
    rows.map((row) => ({
      base_currency: row.base_currency,
      quote_currency: row.quote_currency,
      rate: row.rate,
      source: row.source,
      effective_at: row.effective_at,
      status: row.status,
    })),
  );
  if (error) {
    throw new Error("FX rate insert failed.");
  }
}

/**
 * Latest active row per quote currency, by version. Older rows stay in the table.
 */
export async function loadLatestFxRates(): Promise<CachedFxRate[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("id, quote_currency, rate, version, effective_at, status")
    .eq("base_currency", CATALOGUE_BASE_CURRENCY)
    .eq("status", "active")
    .order("version", { ascending: false });
  if (error) {
    throw new Error("FX rate read failed.");
  }
  return selectLatestFxRates(Array.isArray(data) ? data : []);
}

export function selectLatestFxRates(rows: readonly FxRateRow[]): CachedFxRate[] {
  const ordered = [...rows].sort((left, right) => versionOf(right) - versionOf(left));
  const latest = new Map<FxQuoteCurrency, CachedFxRate>();
  for (const row of ordered) {
    if (row.status !== "active") {
      continue;
    }
    const quote = typeof row.quote_currency === "string" ? row.quote_currency : "";
    if (!(FX_QUOTE_CURRENCIES as readonly string[]).includes(quote)) {
      continue;
    }
    const quoteCurrency = quote as FxQuoteCurrency;
    if (latest.has(quoteCurrency)) {
      continue;
    }
    const id = typeof row.id === "string" ? row.id : "";
    const rate = rateText(row.rate);
    const version = typeof row.version === "number" ? row.version : Number(row.version);
    const effectiveAt = typeof row.effective_at === "string" ? row.effective_at : "";
    if (!id || !rate || !Number.isInteger(version) || version < 1 || !effectiveAt) {
      continue;
    }
    latest.set(quoteCurrency, {
      id,
      version,
      quoteCurrency,
      rate,
      effectiveAt,
    });
  }
  return FX_QUOTE_CURRENCIES.map((quote) => latest.get(quote)).filter(
    (row): row is CachedFxRate => row != null,
  );
}

function versionOf(row: FxRateRow): number {
  const version = typeof row.version === "number" ? row.version : Number(row.version);
  return Number.isInteger(version) ? version : 0;
}

function rateText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return parsePositiveDecimalRate(trimmed) ? trimmed : null;
}

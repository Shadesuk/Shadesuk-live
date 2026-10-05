import {
  effectiveAtFromDate,
  parseFrankfurterLatestRates,
  type FxObservation,
} from "./observations";

export type FxRateInsert = {
  base_currency: "GBP";
  quote_currency: FxObservation["quoteCurrency"];
  rate: string;
  source: "frankfurter";
  effective_at: string;
  status: "active";
};

export type FxRefreshOutcome =
  | { ok: true; inserted: number; keptLastRates: false }
  | { ok: false; inserted: 0; keptLastRates: true; reason: string };

export function observationsToInserts(observations: readonly FxObservation[]): FxRateInsert[] {
  return observations.map((row) => ({
    base_currency: row.baseCurrency,
    quote_currency: row.quoteCurrency,
    rate: row.rate,
    source: row.source,
    effective_at: effectiveAtFromDate(row.effectiveOn),
    status: "active" as const,
  }));
}

/**
 * Fetch, validate, then insert. Any failure returns before insert, or after a
 * failed insert, and never deletes existing rows.
 */
export async function runFxRefresh(input: {
  fetchBody: () => Promise<string>;
  insert: (rows: readonly FxRateInsert[]) => Promise<void>;
  now?: Date;
}): Promise<FxRefreshOutcome> {
  let body: string;
  try {
    body = await input.fetchBody();
  } catch {
    return { ok: false, inserted: 0, keptLastRates: true, reason: "fetch_failed" };
  }

  const parsed = parseFrankfurterLatestRates(body, input.now);
  if (!parsed.ok) {
    return { ok: false, inserted: 0, keptLastRates: true, reason: parsed.reason };
  }

  const rows = observationsToInserts(parsed.observations);
  try {
    await input.insert(rows);
  } catch {
    return { ok: false, inserted: 0, keptLastRates: true, reason: "persist_failed" };
  }
  return { ok: true, inserted: rows.length, keptLastRates: false };
}

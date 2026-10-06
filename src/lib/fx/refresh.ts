import { parsePositiveDecimalRate, type DecimalRate } from "@/contracts/pricing";
import {
  effectiveAtFromDate,
  parseFrankfurterLatestRates,
  type FxObservation,
  type FxStoredQuoteCurrency,
} from "./observations";

/** Reject a move strictly larger than 15% from the last active rate. */
export const FX_RATE_BAND_NUMERATOR = BigInt(15);
export const FX_RATE_BAND_DENOMINATOR = BigInt(100);

export type FxRateInsert = {
  base_currency: "GBP";
  quote_currency: FxObservation["quoteCurrency"];
  rate: string;
  source: "frankfurter";
  effective_at: string;
  status: "active";
};

export type PriorFxRate = {
  quoteCurrency: FxStoredQuoteCurrency;
  rate: string;
  effectiveAt: string;
};

export type FxRefreshOutcome =
  | { ok: true; inserted: number; keptLastRates: boolean; reason?: "unchanged" }
  | { ok: false; inserted: 0; keptLastRates: true; reason: string };

export type FxPersistPlan =
  | { action: "reject"; reason: "out_of_band" }
  | { action: "skip" }
  | { action: "insert"; rows: FxRateInsert[] };

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
 * Compare a validated batch with the latest active rows.
 * A first observation for a pair skips the band. Any later move above 15%
 * rejects the whole batch. A quote whose latest row already has the same
 * effective time and rate is not inserted again.
 */
export function planFxPersistence(
  rows: readonly FxRateInsert[],
  previous: readonly PriorFxRate[] = [],
): FxPersistPlan {
  const prior = new Map(previous.map((row) => [row.quoteCurrency, row]));
  const pending: FxRateInsert[] = [];
  for (const row of rows) {
    const last = prior.get(row.quote_currency);
    if (!last) {
      pending.push(row);
      continue;
    }
    const previousRate = parsePositiveDecimalRate(last.rate.trim());
    const nextRate = parsePositiveDecimalRate(row.rate);
    if (!previousRate || !nextRate || relativeMoveExceedsBand(previousRate, nextRate)) {
      return { action: "reject", reason: "out_of_band" };
    }
    if (sameEffectiveInstant(last.effectiveAt, row.effective_at) && sameRate(previousRate, nextRate)) {
      continue;
    }
    pending.push(row);
  }
  if (pending.length === 0) {
    return { action: "skip" };
  }
  return { action: "insert", rows: pending };
}

/**
 * Fetch, validate, then insert. Any failure returns before insert, or after a
 * failed insert, and never deletes existing rows. An unchanged batch is a
 * successful no-op.
 */
export async function runFxRefresh(input: {
  fetchBody: () => Promise<string>;
  insert: (rows: readonly FxRateInsert[]) => Promise<void | number>;
  previous?: readonly PriorFxRate[];
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
  const plan = planFxPersistence(rows, input.previous ?? []);
  if (plan.action === "reject") {
    return { ok: false, inserted: 0, keptLastRates: true, reason: plan.reason };
  }
  if (plan.action === "skip") {
    return { ok: true, inserted: 0, keptLastRates: true, reason: "unchanged" };
  }
  let inserted = plan.rows.length;
  try {
    const written = await input.insert(plan.rows);
    if (typeof written === "number") {
      inserted = written;
    }
  } catch {
    return { ok: false, inserted: 0, keptLastRates: true, reason: "persist_failed" };
  }
  return { ok: true, inserted, keptLastRates: false };
}

function relativeMoveExceedsBand(previous: DecimalRate, next: DecimalRate): boolean {
  const delta = abs(next.numerator * previous.denominator - previous.numerator * next.denominator);
  const left = delta * FX_RATE_BAND_DENOMINATOR;
  const right = previous.numerator * FX_RATE_BAND_NUMERATOR * next.denominator;
  return left > right;
}

function sameRate(left: DecimalRate, right: DecimalRate): boolean {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}

function sameEffectiveInstant(left: string, right: string): boolean {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs === rightMs;
  }
  return left === right;
}

function abs(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}

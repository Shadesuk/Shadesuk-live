import "server-only";

import { FX_QUOTE_CURRENCIES } from "./observations";
import { fetchFrankfurterLatestRates } from "./frankfurter";
import { fxUpdateAuthorized, resolveFxUpdateSecret } from "./auth";
import { runFxRefresh, type FxRateInsert, type FxRefreshOutcome } from "./refresh";
import { insertFxObservations, loadLatestFxRates } from "./store";

export type FxRefreshHttpResult = {
  status: number;
  body: FxRefreshOutcome | { ok: false };
};

/**
 * Authenticated refresh. The request body is ignored so a caller cannot
 * submit rates. Frankfurter failure does not delete stored rates.
 */
export async function handleFxRefreshRequest(input: {
  authorization: string | null;
  env?: NodeJS.ProcessEnv;
  refresh?: () => Promise<FxRefreshOutcome>;
}): Promise<FxRefreshHttpResult> {
  const secret = resolveFxUpdateSecret(input.env);
  if (!secret) {
    return { status: 503, body: { ok: false, inserted: 0, keptLastRates: true, reason: "not_configured" } };
  }
  if (!fxUpdateAuthorized(input.authorization, secret)) {
    return { status: 401, body: { ok: false } };
  }

  const refresh =
    input.refresh ??
    (async () => {
      let previous;
      try {
        previous = await loadLatestFxRates();
      } catch {
        return {
          ok: false as const,
          inserted: 0,
          keptLastRates: true as const,
          reason: "persist_failed",
        };
      }
      return runFxRefresh({
        fetchBody: async () => {
          const fetched = await fetchFrankfurterLatestRates();
          if (!fetched.ok) {
            throw new Error(fetched.reason);
          }
          return JSON.stringify(
            fetched.observations.map((row) => ({
              date: row.effectiveOn,
              base: row.baseCurrency,
              quote: row.quoteCurrency,
              rate: row.rate,
            })),
          );
        },
        previous,
        insert: insertFxRows,
      });
    });

  const outcome = await refresh();
  if (!outcome.ok) {
    console.error("fx_refresh_failed", { reason: outcome.reason });
    return { status: 503, body: outcome };
  }
  console.info("fx_refresh_ok", { inserted: outcome.inserted });
  return { status: 200, body: outcome };
}

/**
 * Required EUR/USD/INR rows commit on their own. Display currencies wait
 * until their currency rows exist and do not roll the required batch back.
 */
async function insertFxRows(rows: readonly FxRateInsert[]): Promise<number> {
  const required = rows.filter((row) =>
    (FX_QUOTE_CURRENCIES as readonly string[]).includes(row.quote_currency),
  );
  const extra = rows.filter(
    (row) => !(FX_QUOTE_CURRENCIES as readonly string[]).includes(row.quote_currency),
  );
  if (required.length > 0) {
    await insertFxObservations(required);
  }
  if (extra.length === 0) {
    return required.length;
  }
  try {
    await insertFxObservations(extra);
  } catch {
    console.error("fx_optional_persist_failed");
    return required.length;
  }
  return required.length + extra.length;
}

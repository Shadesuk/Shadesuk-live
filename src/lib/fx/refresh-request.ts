import "server-only";

import { fetchFrankfurterLatestRates } from "./frankfurter";
import { fxUpdateAuthorized, resolveFxUpdateSecret } from "./auth";
import { runFxRefresh, type FxRefreshOutcome } from "./refresh";
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
        insert: insertFxObservations,
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

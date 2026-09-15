/**
 * Demo catalogue containment.
 *
 * Production never serves fixture products as if they were live inventory.
 * Demo fixtures are allowed only in local development, or when an explicit
 * DEMO_CATALOGUE flag is set.
 *
 * Resolution:
 * - DEMO_CATALOGUE=true|1  → demo on (any NODE_ENV)
 * - DEMO_CATALOGUE=false|0 → demo off (any NODE_ENV, including `next dev`)
 * - otherwise              → demo on only when NODE_ENV=development
 *
 * An empty published Supabase catalogue in production shows designed empty
 * states. It does not fall back to Frame 01–06.
 */

function readFlag(value: string | undefined): boolean | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === "1" || trimmed === "true") {
    return true;
  }
  if (trimmed === "0" || trimmed === "false") {
    return false;
  }
  return undefined;
}

export function resolveDemoCatalogueMode(input: {
  demoCatalogue?: string;
  nodeEnv?: string;
}): { enabled: boolean; forced: boolean } {
  const flag = readFlag(input.demoCatalogue);
  const forced = flag === true;
  if (flag !== undefined) {
    return { enabled: flag, forced };
  }
  return { enabled: input.nodeEnv === "development", forced: false };
}

/** True only when DEMO_CATALOGUE is explicitly set on. */
export function isDemoCatalogueForced(): boolean {
  return resolveDemoCatalogueMode({
    demoCatalogue: process.env.DEMO_CATALOGUE,
    nodeEnv: process.env.NODE_ENV,
  }).forced;
}

export function isDemoCatalogueEnabled(): boolean {
  return resolveDemoCatalogueMode({
    demoCatalogue: process.env.DEMO_CATALOGUE,
    nodeEnv: process.env.NODE_ENV,
  }).enabled;
}

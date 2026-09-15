/**
 * Demo catalogue containment.
 *
 * Production never serves fixture products as if they were live inventory.
 * `DEMO_CATALOGUE` is ignored on the production origin so a leftover flag
 * cannot publish Frame 01–06 as live stock.
 *
 * Resolution:
 * - Production lock (VERCEL_ENV=production, or NODE_ENV=production outside
 *   Vercel preview/development) → demo always off, flag ignored
 * - DEMO_CATALOGUE=true|1  → demo on (dev, Vercel preview)
 * - DEMO_CATALOGUE=false|0 → demo off
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
  vercelEnv?: string;
}): { enabled: boolean; forced: boolean } {
  if (isProductionCatalogueLock(input)) {
    return { enabled: false, forced: false };
  }
  const flag = readFlag(input.demoCatalogue);
  const forced = flag === true;
  if (flag !== undefined) {
    return { enabled: flag, forced };
  }
  return { enabled: input.nodeEnv === "development", forced: false };
}

/** True only when DEMO_CATALOGUE is explicitly set on and production is not locked. */
export function isDemoCatalogueForced(): boolean {
  return resolveDemoCatalogueMode({
    demoCatalogue: process.env.DEMO_CATALOGUE,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  }).forced;
}

export function isDemoCatalogueEnabled(): boolean {
  return resolveDemoCatalogueMode({
    demoCatalogue: process.env.DEMO_CATALOGUE,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  }).enabled;
}

function isProductionCatalogueLock(input: {
  nodeEnv?: string;
  vercelEnv?: string;
}): boolean {
  const vercelEnv = input.vercelEnv?.trim();
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return false;
  }
  if (vercelEnv === "production") {
    return true;
  }
  return input.nodeEnv === "production";
}

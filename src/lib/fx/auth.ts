import { createHash, timingSafeEqual } from "node:crypto";

/** Server secret for the daily FX job. Never NEXT_PUBLIC_. */
export function resolveFxUpdateSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.FX_UPDATE_SECRET?.trim() ?? "";
}

export function fxUpdateAuthorized(authorization: string | null, secret: string): boolean {
  if (!authorization || !secret) {
    return false;
  }
  const expected = createHash("sha256").update(`Bearer ${secret}`, "utf8").digest();
  const actual = createHash("sha256").update(authorization.trim(), "utf8").digest();
  return timingSafeEqual(expected, actual);
}

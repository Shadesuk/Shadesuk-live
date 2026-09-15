const OWNERSHIP_KEYS = new Set([
  "sessionid",
  "session_id",
  "cartid",
  "cart_id",
  "userid",
  "user_id",
  "owner",
]);

export function hasForbiddenOwnershipKey(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  return Object.keys(raw as Record<string, unknown>).some((key) =>
    OWNERSHIP_KEYS.has(key.toLowerCase()),
  );
}

export function containsForbiddenCartOwnership(value: unknown): boolean {
  const seen = new Set<unknown>();
  return walk(value, seen);
}

function walk(value: unknown, seen: Set<unknown>): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => walk(entry, seen));
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (OWNERSHIP_KEYS.has(key.toLowerCase())) {
      return true;
    }
    if (walk(record[key], seen)) {
      return true;
    }
  }
  return false;
}

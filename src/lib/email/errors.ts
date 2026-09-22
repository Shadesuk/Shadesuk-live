import "server-only";

const SECRET_PATTERNS = [
  /\bre_[A-Za-z0-9]+\b/g,
  /Bearer\s+\S+/gi,
  /(?:api[_-]?key|authorization)\s*[:=]\s*\S+/gi,
];

const ERROR_MAX = 280;

export function providerFailureMessage(error: unknown): string {
  const raw = extractProviderMessage(error);
  const redacted = redactSecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted) {
    return "Resend request failed.";
  }
  return redacted.slice(0, ERROR_MAX);
}

export function redactSecrets(value: string): string {
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[redacted]");
  }
  return next;
}

function extractProviderMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Resend request failed.";
  }
  if ("message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Resend request failed.";
}

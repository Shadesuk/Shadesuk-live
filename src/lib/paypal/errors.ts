import "server-only";

const SECRET_PATTERNS = [
  /\bPAYPAL_[A-Z_]*SECRET\b=\S+/gi,
  /Bearer\s+\S+/gi,
  /(?:client_secret|access_token|authorization)\s*[:=]\s*\S+/gi,
  /A21[A-Za-z0-9_-]{20,}/g,
];

const ERROR_MAX = 280;

export function paypalFailureMessage(error: unknown): string {
  const raw = extractMessage(error);
  const redacted = redactPayPalSecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted) {
    return "PayPal request failed.";
  }
  return redacted.slice(0, ERROR_MAX);
}

export function redactPayPalSecrets(value: string): string {
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[redacted]");
  }
  return next;
}

function extractMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (!error || typeof error !== "object") {
    return "PayPal request failed.";
  }
  if ("message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  if ("error_description" in error && typeof error.error_description === "string") {
    return error.error_description;
  }
  if ("name" in error && typeof error.name === "string" && error.name.trim()) {
    const details =
      "message" in error && typeof error.message === "string" ? error.message : "";
    return details ? `${error.name}: ${details}` : error.name;
  }
  return "PayPal request failed.";
}

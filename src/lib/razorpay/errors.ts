import "server-only";

const SECRET_PATTERNS = [
  /\brzp_(live|test)_[A-Za-z0-9]+/g,
  /\bRAZORPAY_[A-Z_]*SECRET\b=\S+/gi,
  /Bearer\s+\S+/gi,
  /(?:key_secret|webhook_secret|api[_-]?key|authorization)\s*[:=]\s*\S+/gi,
];

const ERROR_MAX = 280;

export function razorpayFailureMessage(error: unknown): string {
  const raw = extractMessage(error);
  const redacted = redactRazorpaySecrets(raw).replace(/\s+/g, " ").trim();
  if (!redacted) {
    return "Razorpay request failed.";
  }
  return redacted.slice(0, ERROR_MAX);
}

export function redactRazorpaySecrets(value: string): string {
  let next = value;
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "[redacted]");
  }
  return next;
}

function extractMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Razorpay request failed.";
  }
  if ("error" in error && error.error && typeof error.error === "object") {
    const nested = error.error as { description?: unknown; message?: unknown };
    if (typeof nested.description === "string" && nested.description.trim()) {
      return nested.description;
    }
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message;
    }
  }
  if ("message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "Razorpay request failed.";
}

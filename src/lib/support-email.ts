import "server-only";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public support address, only when RESEND_REPLY_TO is a real mailbox.
 * Never invent one. Contact copy stays unpublished until this is set.
 */
export function resolveSupportEmail(): string | null {
  const value = process.env.RESEND_REPLY_TO?.trim() ?? "";
  if (!value || !EMAIL_PATTERN.test(value)) {
    return null;
  }
  return value;
}

/** Manual fulfilment may paste a tracking URL. Only https may be rendered. */

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

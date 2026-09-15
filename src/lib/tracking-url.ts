/** Manual fulfilment may paste a tracking URL. Only http(s) may be rendered. */

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Help / tracking destinations shown on legal pages.
 * External URLs must be https. Protocol-relative and http are rejected.
 */
export const ICO_HELP_URL = "https://ico.org.uk";
export const CONSUMER_RIGHTS_HELP_URL =
  "https://www.gov.uk/consumer-protection-rights";

export function isAllowedHelpHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return true;
  }
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

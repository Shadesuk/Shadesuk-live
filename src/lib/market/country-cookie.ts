import { supportedCountry } from "@/contracts/countries";

export const COUNTRY_COOKIE = "shadesuk_country";
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function countryFromCookie(raw: string | undefined | null): string | null {
  if (!raw) {
    return null;
  }
  const code = raw.trim().toUpperCase();
  return supportedCountry(code) ? code : null;
}

export function writeCountryCookie(code: string): void {
  if (typeof document === "undefined" || !supportedCountry(code)) {
    return;
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COUNTRY_COOKIE}=${code}; Path=/; Max-Age=${COUNTRY_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

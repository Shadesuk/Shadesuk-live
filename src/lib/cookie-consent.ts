/**
 * First-party cookie consent. Strictly necessary cookies are not gated.
 * Analytics must not run until analytics is true.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "shadesuk.cookie-consent";
export const COOKIE_CONSENT_COOKIE_NAME = "shadesuk_cookie_consent";
export const COOKIE_SETTINGS_EVENT = "shadesuk:cookie-settings";
export const COOKIE_CONSENT_CHANGED_EVENT = "shadesuk:cookie-consent-changed";
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type CookieConsentState = {
  version: typeof COOKIE_CONSENT_VERSION;
  analytics: boolean;
  decidedAt: string;
};

export function openCookieSettings(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}

export function subscribeCookieConsent(onChange: () => void): () => void {
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function cookieConsentSnapshot(): string {
  const state = readCookieConsent();
  return state ? `${state.analytics ? "1" : "0"}|${state.decidedAt}` : "";
}

export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromStorage = parseConsent(readStorage());
  if (fromStorage) {
    return fromStorage;
  }
  return parseConsent(readCookieValue());
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function writeCookieConsent(analytics: boolean): CookieConsentState {
  const state: CookieConsentState = {
    version: COOKIE_CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  const encoded = encodeConsent(state);
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, encoded);
  } catch {
    // Private mode can block storage. The cookie still records the choice.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
  return state;
}

function encodeConsent(state: CookieConsentState): string {
  return `v${state.version}.${state.analytics ? "1" : "0"}.${encodeURIComponent(state.decidedAt)}`;
}

function parseConsent(value: string | null): CookieConsentState | null {
  if (!value) {
    return null;
  }
  const match = /^v1\.(0|1)\.(.+)$/.exec(value);
  if (!match) {
    return null;
  }
  const decidedAt = decodeURIComponent(match[2] ?? "");
  if (!decidedAt || Number.isNaN(Date.parse(decidedAt))) {
    return null;
  }
  return {
    version: COOKIE_CONSENT_VERSION,
    analytics: match[1] === "1",
    decidedAt,
  };
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readCookieValue(): string | null {
  const parts = document.cookie.split("; ");
  const prefix = `${COOKIE_CONSENT_COOKIE_NAME}=`;
  const found = parts.find((part) => part.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const KEY = "shadesuk.recently-viewed";
const MAX = 4;
const EVENT = "shadesuk:recently-viewed";
const EMPTY: string[] = [];

let cached: string[] = EMPTY;

function sameIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((id, index) => id === right[index])
  );
}

function read(): string[] {
  if (typeof window === "undefined") {
    return EMPTY;
  }
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) {
      cached = EMPTY;
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cached = EMPTY;
      return EMPTY;
    }
    const next = parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX);
    if (next.length === 0) {
      cached = EMPTY;
      return EMPTY;
    }
    if (sameIds(cached, next)) {
      return cached;
    }
    cached = next;
    return cached;
  } catch {
    cached = EMPTY;
    return EMPTY;
  }
}

export function getRecentlyViewedIds(): string[] {
  return read();
}

export function getRecentlyViewedServerSnapshot(): string[] {
  return EMPTY;
}

export function subscribeRecentlyViewed(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function recordProductView(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const current = getRecentlyViewedIds().filter((item) => item !== id);
  const next = [id, ...current].slice(0, MAX);
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
  cached = next;
  window.dispatchEvent(new Event(EVENT));
}

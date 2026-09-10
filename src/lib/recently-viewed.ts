const KEY = "shadesuk.recently-viewed";
const MAX = 4;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let snapshot: string[] = EMPTY;

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function read(): string[] {
  if (typeof window === "undefined") {
    return EMPTY;
  }
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) {
      snapshot = EMPTY;
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      snapshot = EMPTY;
      return EMPTY;
    }
    const next = parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX);
    if (next.length === 0) {
      snapshot = EMPTY;
      return EMPTY;
    }
    if (same(snapshot, next)) {
      return snapshot;
    }
    snapshot = next;
    return snapshot;
  } catch {
    snapshot = EMPTY;
    return EMPTY;
  }
}

export function getRecentlyViewedIds(): string[] {
  return read();
}

export function getRecentlyViewedServerSnapshot(): string[] {
  return EMPTY;
}

export function subscribeRecentlyViewed(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function recordProductView(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const current = getRecentlyViewedIds().filter((item) => item !== id);
  const next = [id, ...current].slice(0, MAX);
  snapshot = next.length ? next : EMPTY;
  window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  emit();
}

const KEY = "shadesuk.recent-searches";
const MAX = 8;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let snapshot: string[] = EMPTY;

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function parse(raw: string | null): string[] {
  if (!raw) {
    return EMPTY;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return EMPTY;
    }
    const values = parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .slice(0, MAX);
    return values.length ? values : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readStorage(): string[] {
  if (typeof window === "undefined") {
    return EMPTY;
  }
  const next = parse(window.localStorage.getItem(KEY));
  if (same(snapshot, next)) {
    return snapshot;
  }
  snapshot = next === EMPTY ? EMPTY : next;
  return snapshot;
}

function writeStorage(next: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  snapshot = next.length ? next : EMPTY;
  if (snapshot === EMPTY) {
    window.localStorage.removeItem(KEY);
  } else {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  }
  emit();
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent): void {
  if (event.key === KEY) {
    snapshot = EMPTY;
    readStorage();
    emit();
  }
}

export function getRecentSearches(): string[] {
  return readStorage();
}

export function subscribeRecentSearches(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function recordRecentSearch(query: string): void {
  const value = query.trim().replace(/\s+/g, " ");
  if (!value) {
    return;
  }
  const current = getRecentSearches();
  const next = [
    value,
    ...current.filter((item) => item.toLowerCase() !== value.toLowerCase()),
  ].slice(0, MAX);
  writeStorage(next);
}

export function removeRecentSearch(query: string): void {
  writeStorage(
    getRecentSearches().filter(
      (item) => item.toLowerCase() !== query.trim().toLowerCase(),
    ),
  );
}

export function clearRecentSearches(): void {
  writeStorage([]);
}

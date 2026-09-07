const KEY = "shadesuk.recently-viewed";
const MAX = 4;

export function recordProductView(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const current = getRecentlyViewedIds().filter((item) => item !== id);
  const next = [id, ...current].slice(0, MAX);
  window.sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function getRecentlyViewedIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

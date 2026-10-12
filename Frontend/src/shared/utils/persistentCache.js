/**
 * Tiny localStorage-backed cache for stale-while-revalidate rendering.
 *
 * Pages read the last good response synchronously on mount (instant paint on app
 * reopen), then refetch in the background and overwrite it. Every access is wrapped
 * in try/catch: private mode, quota errors or a corrupt entry just behave like a miss.
 */

const PREFIX = "pc:v1:";

export function readPersistentCache(key, maxAgeMs) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== "number") return null;
    if (maxAgeMs && Date.now() - entry.t > maxAgeMs) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { value: entry.v, savedAt: entry.t };
  } catch {
    return null;
  }
}

export function writePersistentCache(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // Quota exceeded — drop our own entries so the next write can succeed.
    clearPersistentCache();
  }
}

export function clearPersistentCache(keyPrefix = "") {
  try {
    const fullPrefix = PREFIX + keyPrefix;
    const doomed = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

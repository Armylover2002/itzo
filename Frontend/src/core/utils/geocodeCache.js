const STORAGE_KEY = "qc_geocode_cache_v1";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const MAX_ENTRIES = 200;

function normalizeKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadStore() {
  if (typeof window === "undefined") return { v: 1, items: {} };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed || typeof parsed !== "object" || !parsed.items) {
    return { v: 1, items: {} };
  }
  return parsed;
}

function saveStore(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function prune(store) {
  const now = Date.now();
  const entries = Object.entries(store.items || {});
  const alive = entries.filter(([, v]) => v && v.exp && v.exp > now);

  // keep newest
  alive.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
  const kept = alive.slice(0, MAX_ENTRIES);

  const next = { v: 1, items: {} };
  for (const [k, v] of kept) next.items[k] = v;
  return next;
}

export function getCachedGeocode(key) {
  const k = normalizeKey(key);
  if (!k) return null;
  const store = prune(loadStore());
  const hit = store.items[k];
  if (!hit || !hit.exp || hit.exp <= Date.now()) {
    saveStore(store);
    return null;
  }
  return hit.value || null;
}

export function setCachedGeocode(key, value, ttlMs = DEFAULT_TTL_MS) {
  const k = normalizeKey(key);
  if (!k || !value) return;
  const store = prune(loadStore());
  store.items[k] = {
    ts: Date.now(),
    exp: Date.now() + Math.max(60 * 1000, ttlMs),
    value,
  };
  saveStore(store);
}


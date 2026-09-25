/**
 * In-process TTL response cache.
 * Enabled only in production (NODE_ENV=production), unless CACHE_ENABLED=false.
 * Local/dev always bypasses the cache for fresh import feedback.
 */

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

/** Default 2 minutes — rankings change slowly between rounds. */
const DEFAULT_TTL_MS = 120_000;

export function isResponseCacheEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.CACHE_ENABLED === 'false') return false;
  return true;
}

export function responseCacheTtlMs(): number {
  const raw = process.env.CACHE_TTL_MS;
  if (raw == null || raw === '') return DEFAULT_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

export async function getOrSetCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = responseCacheTtlMs(),
): Promise<T> {
  if (!isResponseCacheEnabled()) {
    return loader();
  }

  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Drop all cached entries, or only keys starting with `prefix`. */
export function invalidateResponseCache(prefix?: string): number {
  if (prefix == null || prefix === '') {
    const size = store.size;
    store.clear();
    return size;
  }

  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function responseCacheStats(): { enabled: boolean; size: number; ttlMs: number } {
  return {
    enabled: isResponseCacheEnabled(),
    size: store.size,
    ttlMs: responseCacheTtlMs(),
  };
}

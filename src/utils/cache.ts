import { getConfig } from "../config.js";
import { logger } from "./logger.js";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private refreshing = new Set<string>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    const ttl = getConfig().cacheTtlMs;
    if (ttl <= 0) return;

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
    this.refreshing.delete(key);
  }

  /**
   * Stale-while-revalidate: returns stale data
   * immediately and refreshes in background.
   * If no data cached — awaits fetcher.
   */
  async getOrFetch<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
  ): Promise<R> {
    const entry = this.store.get(key);

    if (entry) {
      const isStale = Date.now() > entry.expiresAt;
      if (isStale && !this.refreshing.has(key)) {
        logger.debug(`Cache stale, refreshing: ${key}`);
        this.refreshInBackground(key, fetcher);
      }
      if (!isStale || entry.data !== undefined) {
        logger.debug(`Cache hit: ${key}`);
        return entry.data as R;
      }
    }

    logger.debug(`Cache miss: ${key}`);
    const data = await fetcher();
    this.set(key, data);
    return data;
  }

  private refreshInBackground<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
  ): void {
    this.refreshing.add(key);
    fetcher()
      .then((data) => this.set(key, data))
      .catch(() => this.refreshing.delete(key));
  }

  invalidate(): void {
    this.store.clear();
    this.refreshing.clear();
  }
}

export const spacesCache = new TtlCache<unknown>();
export const boardsCache = new TtlCache<unknown>();
export const usersCache = new TtlCache<unknown>();
export const rolesCache = new TtlCache<unknown>();

export function invalidateAllCaches(): void {
  spacesCache.invalidate();
  boardsCache.invalidate();
  usersCache.invalidate();
  rolesCache.invalidate();
}

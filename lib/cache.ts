import { Redis } from "@upstash/redis";

/** Key-value cache for Qloo responses and resolved entities. Redis-backed in production. */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

/** In-process cache for dev and tests. Lost on restart; not shared across serverless instances. */
export function memoryCache(): Cache {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      store.set(key, value);
    },
  };
}

/** Qloo responses are kept for a week: long enough to make reruns free, short enough to stay fresh. */
export const QLOO_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Shared cache across serverless instances. Every key expires; replays use their own store
 * (no expiry) so the database can run with eviction off.
 */
export function redisCache(redis: Redis, ttlSeconds = QLOO_CACHE_TTL_SECONDS): Cache {
  return {
    async get<T>(key: string) {
      const value = await redis.get<T>(key);
      return value ?? undefined;
    },
    async set<T>(key: string, value: T) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}

let redisClient: Redis | null | undefined;

/** The Upstash client when configured, otherwise null (local dev without Redis). */
export function getRedis(): Redis | null {
  if (redisClient === undefined) {
    const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
    redisClient = url && token ? new Redis({ url, token }) : null;
  }
  return redisClient;
}

let sharedMemory: Cache | undefined;

/** Redis when configured, else one in-memory cache per process. */
export function getCache(): Cache {
  const redis = getRedis();
  if (redis) return redisCache(redis);
  return (sharedMemory ??= memoryCache());
}

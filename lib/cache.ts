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

// Opt-in check that Upstash is reachable with the .env.local credentials: `npm run test:live`.
import { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";
import { redisCache } from "../../lib/cache";
import { redisCounter } from "../../lib/caps";
import { env, live } from "./env";

describe.skipIf(!live)("Upstash live", () => {
  it("round-trips a cached value and counts with expiry", async () => {
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
    const key = `test:live:${Date.now()}`;
    const cache = redisCache(redis, 60);
    await cache.set(key, { a: [1, 2] });
    expect(await cache.get(key)).toEqual({ a: [1, 2] });
    expect(await cache.get(`${key}:missing`)).toBeUndefined();
    expect(await redis.ttl(key)).toBeGreaterThan(0);

    const counter = redisCounter(redis);
    expect(await counter.incr(`${key}:n`, 60)).toBe(1);
    expect(await counter.incr(`${key}:n`, 60)).toBe(2);
    expect(await redis.ttl(`${key}:n`)).toBeGreaterThan(0);
    await redis.del(key, `${key}:n`);
  }, 15_000);
});

import type { Redis } from "@upstash/redis";

/** Atomic counters with expiry. Redis in production, a Map in dev and tests. */
export interface Counter {
  incr(key: string, ttlSeconds: number): Promise<number>;
  decr(key: string): Promise<void>;
}

export function redisCounter(redis: Redis): Counter {
  return {
    async incr(key, ttlSeconds) {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, ttlSeconds);
      return n;
    },
    async decr(key) {
      await redis.decr(key);
    },
  };
}

export function memoryCounter(): Counter {
  const counts = new Map<string, number>();
  return {
    async incr(key) {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return n;
    },
    async decr(key) {
      counts.set(key, (counts.get(key) ?? 1) - 1);
    },
  };
}

export interface CapLimits {
  perSession: number;
  perDay: number;
}

export type CapResult =
  | { allowed: true; sessionLeft: number; dayLeft: number }
  | { allowed: false; reason: "session" | "day" };

const DAY_SECONDS = 24 * 60 * 60;

export function capLimitsFromEnv(env: Record<string, string | undefined> = process.env): CapLimits {
  const num = (v: string | undefined, fallback: number) => (Number(v) > 0 ? Number(v) : fallback);
  return { perSession: num(env.LIVE_RUNS_PER_SESSION, 3), perDay: num(env.LIVE_RUNS_PER_DAY, 100) };
}

/**
 * Takes one live run from the session and global daily budgets, or refuses.
 * A refused run gives back what it took, so refusals don't use up the budget.
 * Samples are replays and never pass through here.
 */
export async function takeLiveRun(
  counter: Counter,
  sessionId: string,
  limits: CapLimits,
  now = new Date(),
): Promise<CapResult> {
  const dayKey = `caps:day:${now.toISOString().slice(0, 10)}`;
  const sessionKey = `caps:session:${sessionId}`;

  const day = await counter.incr(dayKey, DAY_SECONDS);
  if (day > limits.perDay) {
    await counter.decr(dayKey);
    return { allowed: false, reason: "day" };
  }
  const session = await counter.incr(sessionKey, DAY_SECONDS);
  if (session > limits.perSession) {
    await counter.decr(sessionKey);
    await counter.decr(dayKey);
    return { allowed: false, reason: "session" };
  }
  return { allowed: true, sessionLeft: limits.perSession - session, dayLeft: limits.perDay - day };
}

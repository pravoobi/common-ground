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
  perIp: number;
  perDay: number;
}

export type CapResult =
  | { allowed: true; sessionLeft: number; dayLeft: number }
  | { allowed: false; reason: "session" | "ip" | "day" };

const DAY_SECONDS = 24 * 60 * 60;

export function capLimitsFromEnv(env: Record<string, string | undefined> = process.env): CapLimits {
  const num = (v: string | undefined, fallback: number) => (Number(v) > 0 ? Number(v) : fallback);
  return {
    perSession: num(env.LIVE_RUNS_PER_SESSION, 3),
    perIp: num(env.LIVE_RUNS_PER_IP, 5),
    perDay: num(env.LIVE_RUNS_PER_DAY, 50),
  };
}

/** The cookie is only a convenience: anything that isn't one of our own UUIDs gets a fresh id. */
export function cleanSessionId(value: string | undefined, fresh: () => string): string {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : fresh();
}

/**
 * Takes one live run from the daily, per-IP and per-session budgets, or refuses.
 * The per-session cap is friendly accounting (a cookie can be dropped); the per-IP cap is what
 * stops one client from using the whole day's budget. A refused run gives back what it took,
 * so refusals don't use up any budget. Samples are replays and never pass through here.
 */
export async function takeLiveRun(
  counter: Counter,
  sessionId: string,
  limits: CapLimits,
  now = new Date(),
  ip?: string,
): Promise<CapResult> {
  const dayKey = `caps:day:${now.toISOString().slice(0, 10)}`;
  const taken: string[] = [];
  const take = async (key: string, limit: number) => {
    const n = await counter.incr(key, DAY_SECONDS);
    taken.push(key);
    return { n, over: n > limit };
  };
  const refuse = async (reason: "session" | "ip" | "day"): Promise<CapResult> => {
    for (const key of taken) await counter.decr(key);
    return { allowed: false, reason };
  };

  const day = await take(dayKey, limits.perDay);
  if (day.over) return refuse("day");
  if (ip) {
    const byIp = await take(`caps:ip:${now.toISOString().slice(0, 10)}:${ip}`, limits.perIp);
    if (byIp.over) return refuse("ip");
  }
  const session = await take(`caps:session:${sessionId}`, limits.perSession);
  if (session.over) return refuse("session");
  return { allowed: true, sessionLeft: limits.perSession - session.n, dayLeft: limits.perDay - day.n };
}

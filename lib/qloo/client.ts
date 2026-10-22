import { createHash } from "node:crypto";
import type { z } from "zod";
import { memoryCache, type Cache } from "../cache";
import { InsightsResponse, SearchResponse, TagsResponse } from "./schemas";

export type ParamValue = string | number | boolean | string[];
export type Params = Record<string, ParamValue | undefined>;

/** One Qloo call as shown in the X-ray. Never contains the API key. */
export interface TraceEntry {
  endpoint: string;
  params: Record<string, string>;
  status: number | "cache" | "error";
  ms: number;
  error?: string;
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export interface QlooConfig {
  baseUrl: string;
  apiKey: string;
  cache?: Cache;
  /** Requests per second; Qloo's hackathon limit is 10 (SPIKES.md §1). */
  maxPerSecond?: number;
  maxRetries?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface InsightsQuery {
  type: string;
  signalEntities?: string[];
  signalTags?: string[];
  locationQuery?: string;
  tags?: string[];
  priceLevelMin?: number;
  priceLevelMax?: number;
  popularityMin?: number;
  /** Restrict results to these entities, e.g. to score a fixed pool for one person. */
  resultEntities?: string[];
  explain?: boolean;
  take?: number;
}

export function insightsParams(q: InsightsQuery): Params {
  return {
    "filter.type": q.type,
    "signal.interests.entities": q.signalEntities,
    "signal.interests.tags": q.signalTags,
    "filter.location.query": q.locationQuery,
    "filter.tags": q.tags,
    "filter.price_level.min": q.priceLevelMin,
    "filter.price_level.max": q.priceLevelMax,
    "filter.popularity.min": q.popularityMin,
    "filter.results.entities": q.resultEntities,
    "feature.explainability": q.explain,
    take: q.take,
  };
}

/** Drops undefined/empty values, joins arrays, sorts keys: stable for cache keys. */
export function normaliseParams(params: Params): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function cacheKey(path: string, params: Record<string, string>): string {
  return "qloo:" + createHash("sha256").update(path + "?" + new URLSearchParams(params).toString()).digest("hex");
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Qloo client for one plan run: shares the cache across runs, keeps its own trace.
 * Server-side only; the key never leaves this module.
 */
export function createQlooClient(config: QlooConfig) {
  const {
    baseUrl,
    apiKey,
    cache = memoryCache(),
    maxPerSecond = 10,
    maxRetries = 2,
    timeoutMs = 10_000,
    fetch: fetchFn = fetch,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  } = config;
  if (!baseUrl || !apiKey) throw new QlooError("QLOO_BASE_URL and QLOO_API_KEY must be set");

  const trace: TraceEntry[] = [];
  const recent: number[] = [];

  async function throttle() {
    for (;;) {
      const t = now();
      while (recent.length && t - recent[0] >= 1000) recent.shift();
      if (recent.length < maxPerSecond) {
        recent.push(t);
        return;
      }
      await sleep(1000 - (t - recent[0]));
    }
  }

  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, baseUrl.replace(/\/?$/, "/"));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    for (let attempt = 0; ; attempt++) {
      await throttle();
      let res: Response;
      try {
        res = await fetchFn(url, { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        if (attempt < maxRetries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new QlooError(`Qloo request failed: ${(err as Error).message}`);
      }
      if (res.ok) return res.json();
      if (RETRYABLE.has(res.status) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string; reason?: string };
      throw new QlooError(`Qloo ${res.status}: ${body.message ?? body.reason ?? res.statusText}`, res.status);
    }
  }

  async function get<S extends z.ZodType>(path: string, rawParams: Params, schema: S): Promise<z.output<S>> {
    const params = normaliseParams(rawParams);
    const key = cacheKey(path, params);
    const started = now();

    const cached = await cache.get<z.output<S>>(key);
    if (cached !== undefined) {
      trace.push({ endpoint: path, params, status: "cache", ms: 0 });
      return cached;
    }

    try {
      const parsed = schema.safeParse(await request(path, params));
      if (!parsed.success) throw new QlooError(`Unexpected Qloo response from ${path}: ${parsed.error.message}`);
      await cache.set(key, parsed.data);
      trace.push({ endpoint: path, params, status: 200, ms: now() - started });
      return parsed.data;
    } catch (err) {
      const status = err instanceof QlooError && err.status ? err.status : "error";
      trace.push({ endpoint: path, params, status, ms: now() - started, error: (err as Error).message });
      throw err;
    }
  }

  return {
    trace,
    /** Free text → entities, e.g. `search("Kantara", "urn:entity:movie")`. */
    search: (query: string, type: string, take = 3) =>
      get("search", { query, types: type, take }, SearchResponse).then((r) => r.results),
    /** Keyword → tag ids, e.g. food and diet terms. */
    searchTags: (query: string, take = 5) =>
      get("v2/tags", { "filter.query": query, take }, TagsResponse).then((r) => r.results.tags),
    insights: (q: InsightsQuery) =>
      get("v2/insights", insightsParams(q), InsightsResponse).then((r) => r.results.entities),
  };
}

export type QlooClient = ReturnType<typeof createQlooClient>;

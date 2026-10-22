import type { RunRecord } from "./agent/record";
import { getRedis } from "./cache";

// Recorded runs live in private Redis, never in the repo: they hold Qloo response data,
// which Qloo's terms say must not be published in a public repository.
const key = (sampleId: string) => `replay:run:${sampleId}`;

/** Stored with no expiry; the database runs with eviction off. */
export async function saveReplay(sampleId: string, record: RunRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set to save replays");
  await redis.set(key(sampleId), record);
}

export async function loadReplay(sampleId: string): Promise<RunRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const record = await redis.get<RunRecord>(key(sampleId));
  return record ? { ...record, mode: "replay" } : null;
}

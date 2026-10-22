// Scores the without-Qloo pick the same way as the Qloo pick, so the comparison is like for like:
// one Qloo affinity per person over the same candidate pool, turned into percentiles.
import type { QlooClient } from "../qloo/client";
import { nameMatches } from "../qloo/resolve";
import type { Entity } from "../qloo/schemas";
import { normaliseByPerson } from "../score";
import type { AffinityTable } from "../types";
import { signalsFor, type RunState } from "./steps";

const CITY_ALIASES: Record<string, string[]> = {
  bengaluru: ["bengaluru", "bangalore"],
  mumbai: ["mumbai", "bombay"],
  chennai: ["chennai", "madras"],
  delhi: ["delhi", "new delhi"],
  hyderabad: ["hyderabad", "secunderabad"],
};

export function inCity(e: Entity, city: string): boolean {
  const names = CITY_ALIASES[city.toLowerCase()] ?? [city.toLowerCase()];
  const g = e.properties?.geocode;
  const fields = [g?.city, g?.name, g?.admin1_region, e.properties?.address].filter(Boolean).map((v) => v!.toLowerCase());
  return fields.some((f) => names.some((n) => f.includes(n)));
}

const mentions = (e: Entity, area: string) =>
  [e.name, e.properties?.address].some((v) => v?.toLowerCase().includes(area.toLowerCase()));

/**
 * A restaurant the model named, matched to a Qloo place in the right city, or null if Qloo can't
 * find it. For chains, the branch whose name or address mentions the stated area wins.
 */
export async function findPlaceInCity(qloo: QlooClient, name: string, city: string, area?: string): Promise<Entity | null> {
  for (const query of area ? [`${name} ${area}`, name, `${name} ${city}`] : [name, `${name} ${city}`]) {
    const results = (await qloo.search(query, "urn:entity:place", 5)).filter(
      (e) => inCity(e, city) && (nameMatches(name, e.name) || nameMatches(e.name, name)),
    );
    const hit = (area && results.find((e) => mentions(e, area))) || (area && query.includes(area) ? undefined : results[0]);
    if (hit) return hit;
  }
  return null;
}

export interface ScoredPick {
  id: string;
  name: string;
  /** personId → percentile in the shared pool (0–1) and raw Qloo affinity; null when Qloo gave none. */
  perPerson: Record<string, { percentile: number | null; affinity: number | null }>;
  min: number | null;
  mean: number | null;
}

/**
 * Re-scores the pool for each person with `extraIds` added, then reads off each pick.
 * Adding a place to the pool shifts percentiles slightly, so both picks are scored in this one table.
 */
export async function scorePicks(state: RunState, picks: { id: string; name: string }[]): Promise<ScoredPick[]> {
  const ids = [...new Set([...state.candidates.map((c) => c.id), ...picks.map((p) => p.id)])];
  const table: AffinityTable = Object.fromEntries(ids.map((id) => [id, {} as Record<string, number | null>]));
  await Promise.all(
    state.scoredPeople.map(async (personId) => {
      const s = signalsFor(state, [personId]);
      // Type and city only: the pool filters (price cap, popularity floor) could drop the
      // baseline's place and make it look unscored.
      const results = await state.qloo.insights({
        type: "urn:entity:place",
        locationQuery: state.group.city,
        signalEntities: s.entities,
        signalTags: s.tags,
        resultEntities: ids,
        take: ids.length,
      });
      const byId = new Map(results.map((e) => [e.entity_id, e.query?.affinity ?? null]));
      for (const id of ids) table[id][personId] = byId.get(id) ?? null;
    }),
  );
  const pct = normaliseByPerson(ids, state.scoredPeople, table);
  return picks.map(({ id, name }) => {
    const perPerson = Object.fromEntries(
      state.scoredPeople.map((p) => [p, { percentile: pct[id]?.[p] ?? null, affinity: table[id]?.[p] ?? null }]),
    );
    const known = Object.values(perPerson)
      .map((v) => v.percentile)
      .filter((v): v is number => v !== null);
    return {
      id,
      name,
      perPerson,
      min: known.length ? Math.min(...known) : null,
      mean: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
    };
  });
}

/** The stored "without Qloo vs with Qloo" result for one sample. */
export interface Comparison {
  sampleId: string;
  generatedAt: string;
  model: string;
  baseline: {
    output: import("./baseline").BaselineOutput;
    usage: { inputTokens: number; outputTokens: number };
    ms: number;
  };
  /** The baseline's restaurant as found in Qloo, or null when Qloo has no matching place in the city. */
  baselinePlace: { id: string; name: string; address?: string; priceLevel?: number } | null;
  /** Hard limits the baseline's pick breaks or can't be checked against, in plain words. */
  baselineIssues: { personId: string; reason: string; verified: boolean }[];
  scores: { qloo: ScoredPick; baseline: ScoredPick | null };
  poolSize: number;
}

import type { AffinityTable } from "./types";

/**
 * v1 "maximin": best lowest score, tie-break on mean (the fairness rule).
 * v0 "mean": plain average, kept so the v0 → v1 evidence can be reproduced.
 */
export type Strategy = "maximin" | "mean";

export interface RankOptions {
  strategy?: Strategy;
  /**
   * Rank on each person's percentile within the pool instead of raw affinity (default true).
   * Qloo affinities for one person cluster tightly (0.87–0.94 in spike 3), so raw values
   * would decide on noise.
   */
  normalise?: boolean;
}

export interface GroupScore {
  candidateId: string;
  /** Scores the ranking used: percentiles when normalised, otherwise raw affinity. */
  perPerson: Record<string, number | null>;
  /** Qloo's affinity as returned, for the X-ray. */
  raw: Record<string, number | null>;
  /** Lowest known score; null when no one has a score. */
  min: number | null;
  /** Mean of known scores; null when no one has a score. */
  mean: number | null;
  /** People Qloo returned no score for. */
  missing: string[];
  /** People holding the lowest known score. */
  lowest: string[];
  /** Every person has a score. Incomplete candidates rank after complete ones. */
  complete: boolean;
}

export interface RankedCandidate extends GroupScore {
  rank: number;
}

export function scoreCandidate(
  candidateId: string,
  personIds: string[],
  table: AffinityTable,
): GroupScore {
  const perPerson: Record<string, number | null> = {};
  const missing: string[] = [];
  const known: [string, number][] = [];

  for (const personId of personIds) {
    const value = table[candidateId]?.[personId] ?? null;
    if (value !== null && !Number.isFinite(value)) {
      throw new Error(`Affinity for ${candidateId}/${personId} is not a finite number: ${value}`);
    }
    perPerson[personId] = value;
    if (value === null) missing.push(personId);
    else known.push([personId, value]);
  }

  const min = known.length ? Math.min(...known.map(([, v]) => v)) : null;
  const mean = known.length ? known.reduce((sum, [, v]) => sum + v, 0) / known.length : null;
  const lowest = min === null ? [] : known.filter(([, v]) => v === min).map(([id]) => id);

  return {
    candidateId,
    perPerson,
    raw: { ...perPerson },
    min,
    mean,
    missing,
    lowest,
    complete: missing.length === 0,
  };
}

/**
 * Converts each person's affinities into a percentile rank within the pool: 0 for their
 * lowest candidate, 1 for their highest, mid-rank for ties. Missing scores stay null.
 * A person with a single known score gets 1 for it.
 */
export function normaliseByPerson(
  candidateIds: string[],
  personIds: string[],
  table: AffinityTable,
): AffinityTable {
  const out: AffinityTable = Object.fromEntries(candidateIds.map((id) => [id, {}]));

  for (const personId of personIds) {
    const known = candidateIds
      .map((id) => [id, table[id]?.[personId] ?? null] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null);

    for (const id of candidateIds) out[id][personId] = null;
    for (const [id, value] of known) {
      if (known.length === 1) {
        out[id][personId] = 1;
        continue;
      }
      const below = known.filter(([, v]) => v < value).length;
      const equal = known.filter(([, v]) => v === value).length;
      out[id][personId] = (below + (equal - 1) / 2) / (known.length - 1);
    }
  }

  return out;
}

/** Higher is better; null sorts last. */
function compareDesc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * Ranks candidates for the group. Deterministic: complete candidates first, then by the
 * strategy's primary and secondary keys, then by candidate id.
 */
export function rankForGroup(
  candidateIds: string[],
  personIds: string[],
  table: AffinityTable,
  { strategy = "maximin", normalise = true }: RankOptions = {},
): RankedCandidate[] {
  const [primary, secondary]: (keyof Pick<GroupScore, "min" | "mean">)[] =
    strategy === "maximin" ? ["min", "mean"] : ["mean", "min"];
  const scored = normalise ? normaliseByPerson(candidateIds, personIds, table) : table;

  return candidateIds
    .map((id) => {
      const score = scoreCandidate(id, personIds, scored);
      // Validate and keep the raw values even when ranking on percentiles.
      return normalise ? { ...score, raw: scoreCandidate(id, personIds, table).perPerson } : score;
    })
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        compareDesc(a[primary], b[primary]) ||
        compareDesc(a[secondary], b[secondary]) ||
        a.candidateId.localeCompare(b.candidateId),
    )
    .map((score, i) => ({ ...score, rank: i + 1 }));
}

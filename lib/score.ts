import type { AffinityTable } from "./types";

/**
 * v1 "maximin": best lowest score, tie-break on mean (the fairness rule).
 * v0 "mean": plain average, kept so the v0 → v1 evidence can be reproduced.
 */
export type Strategy = "maximin" | "mean";

export interface GroupScore {
  candidateId: string;
  perPerson: Record<string, number | null>;
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

  return { candidateId, perPerson, min, mean, missing, lowest, complete: missing.length === 0 };
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
  strategy: Strategy = "maximin",
): RankedCandidate[] {
  const [primary, secondary]: (keyof Pick<GroupScore, "min" | "mean">)[] =
    strategy === "maximin" ? ["min", "mean"] : ["mean", "min"];

  return candidateIds
    .map((id) => scoreCandidate(id, personIds, table))
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        compareDesc(a[primary], b[primary]) ||
        compareDesc(a[secondary], b[secondary]) ||
        a.candidateId.localeCompare(b.candidateId),
    )
    .map((score, i) => ({ ...score, rank: i + 1 }));
}

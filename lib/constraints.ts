import type { Candidate, Person } from "./types";

export type ConstraintName = "veg" | "price" | "distance";

export interface ConstraintIssue {
  candidateId: string;
  personId: string;
  constraint: ConstraintName;
  reason: string;
}

export interface ConstraintResult {
  /** Candidates that pass every person's hard constraints (some may be unverified). */
  kept: Candidate[];
  /** Candidates that break at least one person's constraint, with why. */
  excluded: { candidate: Candidate; issues: ConstraintIssue[] }[];
  /** Constraints that couldn't be checked because the candidate data is missing. */
  unverified: ConstraintIssue[];
}

type Check = (
  candidate: Candidate,
  person: Person,
) => { ok: true } | { ok: false; reason: string } | { ok: "unknown"; reason: string } | null;

const checks: Record<ConstraintName, Check> = {
  veg: (c, p) => {
    if (!p.constraints.veg) return null;
    if (c.vegFriendly === undefined) return { ok: "unknown", reason: "veg options not known" };
    return c.vegFriendly ? { ok: true } : { ok: false, reason: "no veg options" };
  },
  price: (c, p) => {
    const max = p.constraints.maxPriceLevel;
    if (max === undefined) return null;
    if (c.priceLevel === undefined) return { ok: "unknown", reason: "price level not known" };
    return c.priceLevel <= max
      ? { ok: true }
      : { ok: false, reason: `price level ${c.priceLevel} is above ${max}` };
  },
  distance: (c, p) => {
    const max = p.constraints.maxDistanceKm;
    if (max === undefined) return null;
    if (c.distanceKm === undefined) return { ok: "unknown", reason: "distance not known" };
    return c.distanceKm <= max
      ? { ok: true }
      : { ok: false, reason: `${c.distanceKm} km is further than ${max} km` };
  },
};

/**
 * Applies every person's hard constraints before scoring.
 * A constraint that can't be checked keeps the candidate but is reported as unverified.
 */
export function applyConstraints(candidates: Candidate[], people: Person[]): ConstraintResult {
  const result: ConstraintResult = { kept: [], excluded: [], unverified: [] };

  for (const candidate of candidates) {
    const issues: ConstraintIssue[] = [];
    for (const person of people) {
      for (const [constraint, check] of Object.entries(checks) as [ConstraintName, Check][]) {
        const outcome = check(candidate, person);
        if (!outcome || outcome.ok === true) continue;
        const issue = { candidateId: candidate.id, personId: person.id, constraint, reason: outcome.reason };
        if (outcome.ok === "unknown") result.unverified.push(issue);
        else issues.push(issue);
      }
    }
    if (issues.length) result.excluded.push({ candidate, issues });
    else result.kept.push(candidate);
  }

  return result;
}

const DISTANCE_STEPS_KM = [1, 2, 5, 10, 20, 50];

/** Rounds a distance limit up to a fixed step so nearby requests share a cache key. */
export function quantiseDistanceKm(km: number): number {
  return DISTANCE_STEPS_KM.find((step) => km <= step) ?? DISTANCE_STEPS_KM[DISTANCE_STEPS_KM.length - 1];
}

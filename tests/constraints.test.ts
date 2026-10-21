import { describe, expect, it } from "vitest";
import { applyConstraints, quantiseDistanceKm } from "../lib/constraints";
import type { Candidate, Person } from "../lib/types";

const place = (id: string, extra: Partial<Candidate> = {}): Candidate => ({ id, name: id, tags: [], ...extra });

const veg: Person = { id: "asha", label: "Asha", constraints: { veg: true } };
const budget: Person = { id: "ravi", label: "Ravi", constraints: { maxPriceLevel: 2 } };
const nearby: Person = { id: "meera", label: "Meera", constraints: { maxDistanceKm: 5 } };
const easy: Person = { id: "kabir", label: "Kabir", constraints: {} };

describe("applyConstraints", () => {
  it("excludes a place that breaks a veg constraint and says why", () => {
    const r = applyConstraints([place("steakhouse", { vegFriendly: false })], [veg]);
    expect(r.kept).toEqual([]);
    expect(r.excluded[0].issues).toEqual([
      { candidateId: "steakhouse", personId: "asha", constraint: "veg", reason: "no veg options" },
    ]);
  });

  it("applies price and distance limits per person", () => {
    const r = applyConstraints(
      [
        place("fancy", { priceLevel: 4, distanceKm: 2 }),
        place("far", { priceLevel: 1, distanceKm: 12 }),
        place("fits", { priceLevel: 2, distanceKm: 5 }),
      ],
      [budget, nearby],
    );
    expect(r.kept.map((c) => c.id)).toEqual(["fits"]);
    expect(r.excluded.map((e) => [e.candidate.id, e.issues[0].constraint])).toEqual([
      ["fancy", "price"],
      ["far", "distance"],
    ]);
  });

  it("keeps a place with unknown data but reports the constraint as unverified", () => {
    const r = applyConstraints([place("mystery")], [veg, budget]);
    expect(r.kept.map((c) => c.id)).toEqual(["mystery"]);
    expect(r.unverified.map((u) => u.constraint)).toEqual(["veg", "price"]);
  });

  it("collects every broken constraint, not just the first", () => {
    const r = applyConstraints([place("bad", { vegFriendly: false, priceLevel: 4, distanceKm: 30 })], [
      veg,
      budget,
      nearby,
    ]);
    expect(r.excluded[0].issues.map((i) => i.personId)).toEqual(["asha", "ravi", "meera"]);
  });

  it("ignores people with no constraints", () => {
    const r = applyConstraints([place("anything", { vegFriendly: false })], [easy]);
    expect(r.kept).toHaveLength(1);
    expect(r.unverified).toEqual([]);
  });
});

describe("quantiseDistanceKm", () => {
  it("rounds up to the next step and caps at the largest", () => {
    expect([0.5, 1, 3, 7, 15, 200].map(quantiseDistanceKm)).toEqual([1, 1, 5, 10, 20, 50]);
  });
});

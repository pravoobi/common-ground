import { describe, expect, it } from "vitest";
import { rankForGroup, scoreCandidate } from "../lib/score";
import type { AffinityTable } from "../lib/types";

// Synthetic affinities for unit tests only; not Qloo data.
const people = ["asha", "ravi", "meera"];

describe("scoreCandidate", () => {
  it("computes min, mean and who is lowest", () => {
    const table: AffinityTable = { toit: { asha: 0.9, ravi: 0.4, meera: 0.8 } };
    const s = scoreCandidate("toit", people, table);
    expect(s.min).toBe(0.4);
    expect(s.mean).toBeCloseTo(0.7);
    expect(s.lowest).toEqual(["ravi"]);
    expect(s.complete).toBe(true);
  });

  it("never fills in a missing score", () => {
    const table: AffinityTable = { toit: { asha: 0.9, ravi: null } };
    const s = scoreCandidate("toit", people, table);
    expect(s.perPerson).toEqual({ asha: 0.9, ravi: null, meera: null });
    expect(s.missing).toEqual(["ravi", "meera"]);
    expect(s.min).toBe(0.9);
    expect(s.mean).toBe(0.9);
    expect(s.complete).toBe(false);
  });

  it("returns nulls when nobody has a score", () => {
    const s = scoreCandidate("unknown", people, {});
    expect(s.min).toBeNull();
    expect(s.mean).toBeNull();
    expect(s.lowest).toEqual([]);
  });

  it("rejects non-finite affinities instead of ranking on them", () => {
    expect(() => scoreCandidate("x", ["asha"], { x: { asha: Number.NaN } })).toThrow(/finite/);
  });
});

describe("rankForGroup", () => {
  // A crowd-pleaser one person dislikes vs. a place everyone likes moderately.
  const table: AffinityTable = {
    crowdPleaser: { asha: 0.95, ravi: 0.9, meera: 0.1 },
    everyoneOk: { asha: 0.6, ravi: 0.6, meera: 0.6 },
  };

  it("v0 mean picks the place one person dislikes", () => {
    const [top] = rankForGroup(["crowdPleaser", "everyoneOk"], people, table, "mean");
    expect(top.candidateId).toBe("crowdPleaser");
  });

  it("v1 maximin picks the place that works for everyone", () => {
    const [top] = rankForGroup(["crowdPleaser", "everyoneOk"], people, table);
    expect(top.candidateId).toBe("everyoneOk");
    expect(top.rank).toBe(1);
  });

  it("breaks maximin ties on the mean", () => {
    const tied: AffinityTable = {
      a: { asha: 0.5, ravi: 0.6, meera: 0.7 },
      b: { asha: 0.5, ravi: 0.9, meera: 0.9 },
    };
    expect(rankForGroup(["a", "b"], people, tied).map((r) => r.candidateId)).toEqual(["b", "a"]);
  });

  it("ranks incomplete candidates after complete ones, even with higher scores", () => {
    const partial: AffinityTable = {
      highButPartial: { asha: 0.99, ravi: 0.99, meera: null },
      lowButComplete: { asha: 0.3, ravi: 0.3, meera: 0.3 },
    };
    const ranked = rankForGroup(["highButPartial", "lowButComplete"], people, partial);
    expect(ranked.map((r) => r.candidateId)).toEqual(["lowButComplete", "highButPartial"]);
  });

  it("is deterministic on full ties (by candidate id)", () => {
    const same: AffinityTable = { b: { asha: 0.5 }, a: { asha: 0.5 } };
    expect(rankForGroup(["b", "a"], ["asha"], same).map((r) => r.candidateId)).toEqual(["a", "b"]);
  });
});

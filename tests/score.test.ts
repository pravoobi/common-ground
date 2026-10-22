import { describe, expect, it } from "vitest";
import { normaliseByPerson, rankForGroup, scoreCandidate } from "../lib/score";
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

describe("rankForGroup on raw affinities", () => {
  const raw = { normalise: false } as const;
  // A crowd-pleaser one person dislikes vs. a place everyone likes moderately.
  const table: AffinityTable = {
    crowdPleaser: { asha: 0.95, ravi: 0.9, meera: 0.1 },
    everyoneOk: { asha: 0.6, ravi: 0.6, meera: 0.6 },
  };

  it("v0 mean picks the place one person dislikes", () => {
    const [top] = rankForGroup(["crowdPleaser", "everyoneOk"], people, table, { ...raw, strategy: "mean" });
    expect(top.candidateId).toBe("crowdPleaser");
  });

  it("v1 maximin picks the place that works for everyone", () => {
    const [top] = rankForGroup(["crowdPleaser", "everyoneOk"], people, table, raw);
    expect(top.candidateId).toBe("everyoneOk");
    expect(top.rank).toBe(1);
  });

  it("breaks maximin ties on the mean", () => {
    const tied: AffinityTable = {
      a: { asha: 0.5, ravi: 0.6, meera: 0.7 },
      b: { asha: 0.5, ravi: 0.9, meera: 0.9 },
    };
    expect(rankForGroup(["a", "b"], people, tied, raw).map((r) => r.candidateId)).toEqual(["b", "a"]);
  });

  it("ranks incomplete candidates after complete ones, even with higher scores", () => {
    const partial: AffinityTable = {
      highButPartial: { asha: 0.99, ravi: 0.99, meera: null },
      lowButComplete: { asha: 0.3, ravi: 0.3, meera: 0.3 },
    };
    const ranked = rankForGroup(["highButPartial", "lowButComplete"], people, partial, raw);
    expect(ranked.map((r) => r.candidateId)).toEqual(["lowButComplete", "highButPartial"]);
  });

  it("is deterministic on full ties (by candidate id)", () => {
    const same: AffinityTable = { b: { asha: 0.5 }, a: { asha: 0.5 } };
    expect(rankForGroup(["b", "a"], ["asha"], same, raw).map((r) => r.candidateId)).toEqual(["a", "b"]);
  });
});

describe("normaliseByPerson", () => {
  it("turns each person's affinities into a 0–1 percentile within the pool", () => {
    const t: AffinityTable = { a: { asha: 0.87 }, b: { asha: 0.94 }, c: { asha: 0.9 } };
    expect(normaliseByPerson(["a", "b", "c"], ["asha"], t)).toEqual({
      a: { asha: 0 },
      b: { asha: 1 },
      c: { asha: 0.5 },
    });
  });

  it("gives ties the mid-rank and leaves missing scores null", () => {
    const t: AffinityTable = { a: { asha: 0.9 }, b: { asha: 0.9 }, c: { asha: 0.8 }, d: { asha: null } };
    const n = normaliseByPerson(["a", "b", "c", "d"], ["asha"], t);
    expect([n.a.asha, n.b.asha, n.c.asha, n.d.asha]).toEqual([0.75, 0.75, 0, null]);
  });

  it("gives a lone known score 1", () => {
    expect(normaliseByPerson(["a", "b"], ["asha"], { a: { asha: 0.5 } })).toEqual({
      a: { asha: 1 },
      b: { asha: null },
    });
  });
});

describe("rankForGroup (default: normalised maximin)", () => {
  // Clustered like real Qloo output (spike 3). Synthetic values.
  // A: top for Asha and Ravi, bottom for Meera. B: middle for everyone.
  const pool = ["A", "B", "C", "D", "E"];
  const table: AffinityTable = {
    A: { asha: 0.94, ravi: 0.93, meera: 0.88 },
    B: { asha: 0.91, ravi: 0.91, meera: 0.91 },
    C: { asha: 0.92, ravi: 0.9, meera: 0.9 },
    D: { asha: 0.9, ravi: 0.92, meera: 0.92 },
    E: { asha: 0.89, ravi: 0.89, meera: 0.93 },
  };

  it("v0 mean favours the place one person ranks last", () => {
    expect(rankForGroup(pool, people, table, { strategy: "mean" })[0].candidateId).toBe("A");
  });

  it("v1 maximin picks the place nobody ranks low", () => {
    const [top] = rankForGroup(pool, people, table);
    expect(top.candidateId).toBe("B");
    expect(top.perPerson).toEqual({ asha: 0.5, ravi: 0.5, meera: 0.5 });
  });

  it("keeps Qloo's raw affinities alongside the percentiles", () => {
    const [top] = rankForGroup(pool, people, table);
    expect(top.raw).toEqual({ asha: 0.91, ravi: 0.91, meera: 0.91 });
  });

  it("still rejects non-finite affinities", () => {
    expect(() => rankForGroup(["x", "y"], ["asha"], { x: { asha: Number.NaN }, y: { asha: 0.5 } })).toThrow(/finite/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { assemblePlan } from "../lib/agent/record";
import { chooseOption, createRunState, explainPick, findCandidates, rankGroup, resolveTastes } from "../lib/agent/steps";
import type { GroupInput } from "../lib/group";
import type { InsightsQuery, QlooClient } from "../lib/qloo/client";
import type { Entity, InsightEntity } from "../lib/qloo/schemas";

// Hand-written fixtures shaped like Qloo responses; ids, names and scores are made up.
const group: GroupInput = {
  title: "Test group",
  city: "Bengaluru",
  people: [
    { id: "asha", label: "Asha", tastes: ["Film A", "filter coffee"], constraints: { veg: true } },
    { id: "ravi", label: "Ravi", tastes: ["Singer B"], constraints: { maxPriceLevel: 2 } },
    { id: "meera", label: "Meera", tastes: ["Show C", "Nonsense input"], constraints: {} },
  ],
};

const searchResults: Record<string, Entity[]> = {
  "Film A": [{ entity_id: "film-a", name: "Film A", popularity: 0.8 }],
  "Singer B": [
    { entity_id: "singer-b", name: "Singer B", popularity: 0.5 },
    { entity_id: "singer-b-full", name: "Singer B Fullname", popularity: 0.9 },
  ],
  "Show C": [{ entity_id: "show-c", name: "Show C", popularity: 0.7 }],
  "Nonsense input": [{ entity_id: "junk", name: "Something Else", popularity: 0.9 }],
};

const vegTag = { id: "urn:tag:dietary_option:qloo:vegetarian", name: "Vegetarian", type: undefined };
const coffeeTag = { id: "urn:tag:specialty_dish:place:filter_coffee", name: "Filter Coffee", type: undefined };

const place = (id: string, price: number, tags: (typeof vegTag)[] = []): InsightEntity => ({
  entity_id: id,
  name: `Place ${id}`,
  properties: { price_level: price, cuisine_description: `Cuisine of ${id}` },
  tags,
});
const pool = [
  place("p1", 2, [vegTag, coffeeTag]),
  place("p2", 1, [vegTag]),
  place("p3", 2),
  place("p4", 3, [vegTag]),
  place("p5", 1, [vegTag]),
];

// Per-person affinity over the pool (p4 is dropped by Ravi's budget). Averaging picks p2, which
// Ravi and Meera love and Asha likes least; maximin picks p1, which nobody ranks last.
const affinity: Record<string, Record<string, number>> = {
  "film-a,filter_coffee": { p1: 0.92, p5: 0.91, p3: 0.9, p2: 0.88 },
  "singer-b-full": { p2: 0.95, p3: 0.92, p1: 0.91, p5: 0.89 },
  "show-c": { p2: 0.93, p5: 0.91, p1: 0.9, p3: 0.88 },
};

function fakeQloo() {
  const insights = vi.fn(async (q: InsightsQuery): Promise<InsightEntity[]> => {
    if (!q.resultEntities) return pool;
    const key = [...(q.signalEntities ?? []), ...(q.signalTags ?? []).map((t) => t.split(":").pop())].join(",");
    const scores = affinity[key] ?? {};
    return pool
      .filter((p) => q.resultEntities!.includes(p.entity_id) && p.entity_id in scores)
      .map((p) => ({
        ...p,
        query: {
          affinity: scores[p.entity_id],
          explainability: { "signal.interests.entities": (q.signalEntities ?? []).map((id, i) => ({ entity_id: id, score: 1 - i / 10 })) },
        },
      }));
  });
  const client: QlooClient = {
    trace: [],
    search: vi.fn(async (query: string) => searchResults[query] ?? []),
    searchTags: vi.fn(async (query: string) => (query === "filter coffee" ? [coffeeTag] : [])),
    insights,
  };
  return { client, insights };
}

async function resolvedState() {
  const { client, insights } = fakeQloo();
  const state = createRunState(group, client);
  await resolveTastes(state, [
    { person_id: "asha", taste: "Film A", query: "Film A", kind: "movie" },
    { person_id: "asha", taste: "filter coffee", query: "filter coffee", kind: "food_or_drink" },
    { person_id: "ravi", taste: "Singer B", query: "Singer B", kind: "artist" },
    { person_id: "meera", taste: "Show C", query: "Show C", kind: "tv_show" },
    { person_id: "meera", taste: "Nonsense input", query: "Nonsense input", kind: "movie" },
  ]);
  return { state, insights };
}

describe("resolveTastes", () => {
  it("resolves entities and food tags, flags ambiguity and junk matches", async () => {
    const { state } = await resolvedState();
    const status = Object.fromEntries(state.tastes.map((t) => [t.input, t.status]));
    expect(status).toEqual({
      "Film A": "resolved",
      "filter coffee": "resolved",
      "Singer B": "ambiguous",
      "Show C": "resolved",
      "Nonsense input": "unresolved",
    });
    expect(state.tastes.find((t) => t.input === "filter coffee")?.signal).toEqual({ kind: "tag", ...coffeeTag });
    expect(state.tastes.find((t) => t.input === "Nonsense input")?.signal).toBeUndefined();
  });

  it("rejects a taste the person never typed", async () => {
    const state = createRunState(group, fakeQloo().client);
    await expect(resolveTastes(state, [{ person_id: "asha", taste: "Made up", query: "x", kind: "movie" }])).rejects.toThrow(
      /not one of Asha's tastes/,
    );
  });

  it("turns a failed lookup into an unresolved taste instead of failing the run", async () => {
    const { client } = fakeQloo();
    client.search = vi.fn(async () => {
      throw new Error("Qloo 503");
    });
    const state = createRunState(group, client);
    const out = await resolveTastes(state, [{ person_id: "asha", taste: "Film A", query: "Film A", kind: "movie" }]);
    expect(out.results[0]).toMatchObject({ status: "unresolved", error: "Qloo 503" });
  });
});

describe("resolveTastes retries", () => {
  it("makes the first lookup use the taste as typed", async () => {
    const state = createRunState(group, fakeQloo().client);
    await expect(
      resolveTastes(state, [{ person_id: "meera", taste: "Nonsense input", query: "Show C", kind: "tv_show" }]),
    ).rejects.toThrow(/as typed/);
  });

  it("allows a rewritten retry and keeps the earlier attempt", async () => {
    const { state } = await resolvedState();
    await resolveTastes(state, [{ person_id: "meera", taste: "Nonsense input", query: "Show C", kind: "tv_show" }]);
    const t = state.tastes.find((x) => x.input === "Nonsense input");
    expect(t).toMatchObject({ status: "resolved", query: "Show C" });
    expect(t?.attempts).toEqual([{ query: "Nonsense input", kind: "movie", status: "unresolved" }]);
  });

  it("accepts a result that matches the taste as typed when the query added words", async () => {
    const { client } = fakeQloo();
    client.search = vi.fn(async () => [{ entity_id: "film-a", name: "Film A", popularity: 0.8 }]);
    const state = createRunState(group, client);
    await resolveTastes(state, [{ person_id: "asha", taste: "Film A", query: "Film A", kind: "movie" }]);
    await resolveTastes(state, [{ person_id: "asha", taste: "Film A", query: "Film A Bengaluru", kind: "movie" }]);
    expect(state.tastes[0].status).toBe("resolved");
  });
});

describe("chooseOption", () => {
  it("only accepts an option that was returned", async () => {
    const { state } = await resolvedState();
    expect(() => chooseOption(state, { person_id: "ravi", taste: "Singer B", entity_id: "invented" })).toThrow(/one of the options/);
    chooseOption(state, { person_id: "ravi", taste: "Singer B", entity_id: "singer-b-full" });
    expect(state.tastes.find((t) => t.input === "Singer B")).toMatchObject({ status: "resolved", chosenByAgent: true });
  });
});

describe("findCandidates and rankGroup", () => {
  it("uses every resolved signal, applies the tightest price cap, and ranks fairly", async () => {
    const { state, insights } = await resolvedState();
    chooseOption(state, { person_id: "ravi", taste: "Singer B", entity_id: "singer-b-full" });

    await findCandidates(state, {});
    expect(insights.mock.calls[0][0]).toMatchObject({
      signalEntities: ["film-a", "singer-b-full", "show-c"],
      signalTags: [coffeeTag.id],
      locationQuery: "Bengaluru",
      priceLevelMax: 2,
    });

    const out = await rankGroup(state);
    // p4 breaks Ravi's budget; p3 has no veg tag, so it is kept but unverified for Asha.
    expect(out.excluded.map((x) => x.name)).toEqual(["Place p4"]);
    expect(out.unverified).toEqual(["Place p3: veg options not known (for asha)"]);
    expect(state.ranking[0].candidateId).toBe("p1");
    expect(state.meanRanking[0].candidateId).toBe("p2");
    expect(out.averaging_would_pick?.name).toBe("Place p2");
  });

  it("leaves out of scoring a person with no resolved tastes", async () => {
    const { client } = fakeQloo();
    const state = createRunState(group, client);
    await resolveTastes(state, [
      { person_id: "asha", taste: "Film A", query: "Film A", kind: "movie" },
      { person_id: "meera", taste: "Nonsense input", query: "Nonsense input", kind: "movie" },
    ]);
    await findCandidates(state, {});
    const out = await rankGroup(state);
    expect(out.people_scored).toEqual(["asha"]);
    expect(out.people_without_tastes).toEqual(["ravi", "meera"]);
  });
});

describe("explainPick and assemblePlan", () => {
  async function rankedState() {
    const { state } = await resolvedState();
    chooseOption(state, { person_id: "ravi", taste: "Singer B", entity_id: "singer-b-full" });
    await findCandidates(state, {});
    await rankGroup(state);
    return state;
  }

  it("builds evidence only from Qloo explainability, matched tags and place properties", async () => {
    const state = await rankedState();
    const out = explainPick(state, { candidate_id: "p1" });
    expect(out.by_person.asha.map((e) => e.text)).toEqual([
      'Qloo links this place to their taste "Film A" (Film A)',
      'The place is tagged "Filter Coffee", which matches their "filter coffee"',
    ]);
    expect(out.place_facts.map((e) => e.text)).toContain("Cuisine: Cuisine of p1");
    expect(() => explainPick(state, { candidate_id: "nowhere" })).toThrow();
  });

  it("keeps the fair pick and drops evidence the model made up or borrowed from someone else", async () => {
    const state = await rankedState();
    explainPick(state, { candidate_id: "p1" });
    const plan = assemblePlan(state, {
      headline: "Saturday: Place p1",
      reasons: [
        { person_id: "asha", text: "Your film and your coffee.", evidence_ids: ["asha-1", "asha-2"] },
        { person_id: "ravi", text: "Borrowed reason.", evidence_ids: ["asha-1", "made-up"] },
        { person_id: "ghost", text: "Not in the group.", evidence_ids: ["f1"] },
      ],
      assumptions: [{ person_id: "ravi", text: "Took Singer B to mean Singer B Fullname." }],
      clarifying_question: null,
      fairness_note: "Averaging would have left Asha out.",
    });
    expect(plan.pick?.name).toBe("Place p1");
    expect(plan.averagingPick?.name).toBe("Place p2");
    expect(plan.reasons.map((r) => [r.personId, r.grounded])).toEqual([
      ["asha", true],
      ["ravi", false],
    ]);
    expect(plan.pick?.scores.asha.affinity).toBe(0.92);
  });

  it("still returns a plan shell when the model gave no output", async () => {
    const state = await rankedState();
    const plan = assemblePlan(state, null);
    expect(plan).toMatchObject({ headline: "Plan: Place p1", reasons: [], fairnessNote: null });
  });
});

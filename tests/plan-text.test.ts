import { describe, expect, it } from "vitest";
import type { RunRecord } from "../lib/agent/record";
import { shortName, whatsappLink, whatsappText } from "../lib/plan-text";

const base: Pick<RunRecord, "group" | "plan"> = {
  group: {
    title: "T",
    city: "Bengaluru",
    people: [
      { id: "a", label: "Asha (fictional)", tastes: ["x"], constraints: {} },
      { id: "b", label: "Ravi", tastes: ["y"], constraints: {} },
    ],
  },
  plan: {
    pick: { id: "p1", name: "Place One", priceLevel: 2, address: "1 Road", scores: {}, leastHappy: [], complete: true },
    runnerUp: null,
    averagingPick: null,
    headline: "Saturday: Place One",
    reasons: [
      { personId: "a", text: "Your film.", evidence: [], grounded: true },
      { personId: "b", text: "Your songs.", evidence: [], grounded: true },
    ],
    assumptions: [],
    clarifyingQuestion: "Asha, ok if it's not fully veg?",
    fairnessNote: null,
  },
};

describe("whatsappText", () => {
  it("puts the place first, then one line per friend, then the question", () => {
    expect(whatsappText(base, "https://example.test/g/1")).toBe(
      [
        "*Saturday: Place One*",
        "Place One · ₹₹ · 1 Road",
        "",
        "• Asha: Your film.",
        "• Ravi: Your songs.",
        "",
        "Asha, ok if it's not fully veg?",
        "",
        "Picked with Common Ground, from each of our tastes on the Qloo taste graph: https://example.test/g/1",
      ].join("\n"),
    );
  });

  it("says so plainly when nothing fit", () => {
    expect(whatsappText({ ...base, plan: { ...base.plan, pick: null, headline: "No place fits everyone" } })).toContain(
      "No place in Bengaluru fit",
    );
  });

  it("builds an encoded wa.me link and strips the fictional marker", () => {
    expect(whatsappLink("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
    expect(shortName("Meera (fictional)")).toBe("Meera");
  });
});

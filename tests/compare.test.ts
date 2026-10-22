import { describe, expect, it, vi } from "vitest";
import { findPlaceInCity, inCity } from "../lib/agent/compare";
import type { QlooClient } from "../lib/qloo/client";
import type { Entity } from "../lib/qloo/schemas";

// Hand-written fixtures; names and addresses are made up.
const place = (name: string, city: string): Entity => ({
  entity_id: `fake-${name}-${city}`,
  name,
  properties: { geocode: { city }, address: `1 Road, ${city}` },
});

function client(results: Record<string, Entity[]>): QlooClient {
  return {
    trace: [],
    search: vi.fn(async (q: string) => results[q] ?? []),
    searchTags: vi.fn(async () => []),
    insights: vi.fn(async () => []),
  };
}

describe("inCity", () => {
  it("accepts old and new city names", () => {
    expect(inCity(place("X", "Bangalore"), "Bengaluru")).toBe(true);
    expect(inCity(place("X", "Pune"), "Bengaluru")).toBe(false);
  });
});

describe("findPlaceInCity", () => {
  it("skips a same-name place in another city", async () => {
    const q = client({ "Cafe One": [place("Cafe One", "London"), place("Cafe One", "Bengaluru")] });
    expect((await findPlaceInCity(q, "Cafe One", "Bengaluru"))?.entity_id).toBe("fake-Cafe One-Bengaluru");
  });

  it("matches a longer Qloo name and retries with the city in the query", async () => {
    const q = client({ "Cafe One Bengaluru": [place("Cafe One Indiranagar", "Bengaluru")] });
    expect((await findPlaceInCity(q, "Cafe One", "Bengaluru"))?.name).toBe("Cafe One Indiranagar");
  });

  it("prefers the branch in the area the model named", async () => {
    const q = client({
      "Cafe One Indiranagar": [place("Cafe One", "Bengaluru"), { ...place("Cafe One", "Bengaluru"), entity_id: "branch", properties: { geocode: { city: "Bengaluru" }, address: "12th Main, Indiranagar, Bengaluru" } }],
    });
    expect((await findPlaceInCity(q, "Cafe One", "Bengaluru", "Indiranagar"))?.entity_id).toBe("branch");
  });

  it("returns null rather than an unrelated place", async () => {
    const q = client({ "Imaginary Bistro": [place("Real Diner", "Bengaluru")] });
    expect(await findPlaceInCity(q, "Imaginary Bistro", "Bengaluru")).toBeNull();
  });
});

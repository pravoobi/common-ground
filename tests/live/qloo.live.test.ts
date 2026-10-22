// Opt-in smoke test against the real Qloo API: `npm run test:live`. Spends ~5 calls.
// Asserts shapes only; prints nothing from the responses beyond counts.
import { describe, expect, it } from "vitest";
import { createQlooClient } from "../../lib/qloo/client";
import { resolveFromResults } from "../../lib/qloo/resolve";
import { env, live } from "./env";

describe.skipIf(!live)("Qloo live", () => {
  it("resolves, recommends and scores a pool end to end", async () => {
    const client = createQlooClient({ baseUrl: env.QLOO_BASE_URL, apiKey: env.QLOO_API_KEY });
    const hit = resolveFromResults("Kantara", await client.search("Kantara", "urn:entity:movie"));
    expect(hit.status).toBe("resolved");
    if (hit.status !== "resolved") return;

    const junk = resolveFromResults("Sid Sriram's new song", await client.search("Sid Sriram's new song", "urn:entity:artist"));
    expect(junk.status).toBe("unresolved");

    const [veg] = await client.searchTags("vegetarian");
    expect(veg.id).toMatch(/^urn:tag:/);

    const base = {
      type: "urn:entity:place",
      locationQuery: "Bengaluru",
      tags: ["urn:tag:category:place:restaurant"],
      priceLevelMin: 1,
      popularityMin: 0.3,
    };
    const pool = await client.insights({ ...base, signalEntities: [hit.entity.entity_id], take: 5 });
    expect(pool.length).toBeGreaterThan(0);

    const scored = await client.insights({
      ...base,
      signalEntities: [hit.entity.entity_id],
      resultEntities: pool.map((p) => p.entity_id),
      explain: true,
      take: pool.length,
    });
    expect(scored.length).toBe(pool.length);
    expect(scored.every((p) => typeof p.query?.affinity === "number")).toBe(true);
    console.log("live trace:", client.trace.map((t) => `${t.endpoint} ${t.status} ${t.ms}ms`).join(" | "));
  }, 30_000);
});

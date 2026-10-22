import { describe, expect, it, vi } from "vitest";
import { cacheKey, createQlooClient, normaliseParams, QlooError, type QlooConfig } from "../lib/qloo/client";

// Hand-written fixtures shaped like Qloo responses; ids and values are made up.
const insightsBody = {
  success: true,
  results: {
    entities: [
      {
        entity_id: "fake-place-1",
        name: "Test Cafe",
        popularity: 0.5,
        properties: { price_level: 2, geocode: { city: "Bengaluru" }, unused_field: "dropped" },
        tags: [{ id: "urn:tag:dietary_option:qloo:vegetarian", name: "Vegetarian" }],
        query: {
          affinity: 0.91,
          explainability: { "signal.interests.entities": [{ entity_id: "fake-artist", score: 0.4 }] },
        },
      },
    ],
  },
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(responses: Response[], extra: Partial<QlooConfig> = {}) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = createQlooClient({
    baseUrl: "https://qloo.test/",
    apiKey: "test-key",
    fetch: fetchMock,
    sleep,
    ...extra,
  });
  return { client, fetchMock, sleep };
}

describe("createQlooClient", () => {
  it("sends the key as X-Api-Key and builds insights params", async () => {
    const { client, fetchMock } = setup([json(insightsBody)]);
    await client.insights({
      type: "urn:entity:place",
      signalEntities: ["a", "b"],
      locationQuery: "Bengaluru",
      priceLevelMin: 1,
      explain: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url as URL);
    expect(u.pathname).toBe("/v2/insights");
    expect(u.searchParams.get("signal.interests.entities")).toBe("a,b");
    expect(u.searchParams.get("filter.location.query")).toBe("Bengaluru");
    expect(u.searchParams.get("feature.explainability")).toBe("true");
    expect(u.searchParams.has("take")).toBe(false);
    expect(u.toString()).not.toContain("test-key");
    expect((init as RequestInit).headers).toEqual({ "X-Api-Key": "test-key" });
  });

  it("parses affinity and explainability, normalises tag ids, drops unused fields", async () => {
    const { client } = setup([json(insightsBody)]);
    const [place] = await client.insights({ type: "urn:entity:place" });
    expect(place.query?.affinity).toBe(0.91);
    expect(place.query?.explainability?.["signal.interests.entities"]?.[0].entity_id).toBe("fake-artist");
    expect(place.tags?.[0].id).toBe("urn:tag:dietary_option:qloo:vegetarian");
    expect(place.properties).not.toHaveProperty("unused_field");
  });

  it("maps search tags from tag_id to id", async () => {
    const { client } = setup([
      json({ results: [{ entity_id: "x", name: "X", tags: [{ tag_id: "urn:tag:genre:indian", name: "Indian" }] }] }),
    ]);
    const [hit] = await client.search("X", "urn:entity:artist");
    expect(hit.tags?.[0]).toEqual({ id: "urn:tag:genre:indian", name: "Indian", type: undefined });
  });

  it("serves repeat requests from the cache and traces both", async () => {
    const { client, fetchMock } = setup([json(insightsBody)]);
    await client.insights({ type: "urn:entity:place", signalEntities: ["b", "a"] });
    await client.insights({ type: "urn:entity:place", signalEntities: ["b", "a"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.trace.map((t) => t.status)).toEqual([200, "cache"]);
    expect(JSON.stringify(client.trace)).not.toContain("test-key");
  });

  it("retries 429 using retry-after, then succeeds", async () => {
    const { client, fetchMock, sleep } = setup([json({}, 429, { "retry-after": "2" }), json(insightsBody)]);
    await client.insights({ type: "urn:entity:place" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("does not retry or cache a 4xx, and reports Qloo's message", async () => {
    const { client, fetchMock } = setup([json({ message: "bad filter" }, 400), json(insightsBody)]);
    await expect(client.insights({ type: "urn:entity:place" })).rejects.toThrow("Qloo 400: bad filter");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.trace[0]).toMatchObject({ status: 400, error: "Qloo 400: bad filter" });
    await client.insights({ type: "urn:entity:place" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a response with an unexpected shape", async () => {
    const { client } = setup([json({ results: { entities: [{ name: "no id" }] } })]);
    await expect(client.insights({ type: "urn:entity:place" })).rejects.toBeInstanceOf(QlooError);
  });

  it("gives up after maxRetries on repeated network errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const client = createQlooClient({
      baseUrl: "https://qloo.test",
      apiKey: "k",
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async () => {},
      maxRetries: 2,
    });
    await expect(client.search("x", "urn:entity:artist")).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("waits when more than maxPerSecond requests go out within a second", async () => {
    let t = 0;
    const sleep = vi.fn(async (ms: number) => {
      t += ms;
    });
    const { client } = setup(
      [json({ results: [] }), json({ results: [] }), json({ results: [] })],
      { maxPerSecond: 2, now: () => t, sleep },
    );
    await client.search("a", "urn:entity:artist");
    await client.search("b", "urn:entity:artist");
    await client.search("c", "urn:entity:artist");
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("refuses to start without credentials", () => {
    expect(() => createQlooClient({ baseUrl: "", apiKey: "" })).toThrow(/QLOO_BASE_URL/);
  });
});

describe("cache keys", () => {
  it("ignore param order and empty values", () => {
    const a = normaliseParams({ b: "2", a: ["x", "y"], c: undefined, d: [] });
    const b = normaliseParams({ a: ["x", "y"], b: 2 });
    expect(a).toEqual({ a: "x,y", b: "2" });
    expect(cacheKey("v2/insights", a)).toBe(cacheKey("v2/insights", b));
  });
});

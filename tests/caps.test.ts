import { describe, expect, it } from "vitest";
import { capLimitsFromEnv, memoryCounter, takeLiveRun } from "../lib/caps";

const limits = { perSession: 2, perDay: 3 };
const day = new Date("2026-10-28T10:00:00Z");

describe("takeLiveRun", () => {
  it("allows runs up to the session cap, then refuses", async () => {
    const c = memoryCounter();
    expect(await takeLiveRun(c, "s1", limits, day)).toEqual({ allowed: true, sessionLeft: 1, dayLeft: 2 });
    expect(await takeLiveRun(c, "s1", limits, day)).toMatchObject({ allowed: true, sessionLeft: 0 });
    expect(await takeLiveRun(c, "s1", limits, day)).toEqual({ allowed: false, reason: "session" });
  });

  it("does not charge the daily budget for a session refusal", async () => {
    const c = memoryCounter();
    await takeLiveRun(c, "s1", limits, day);
    await takeLiveRun(c, "s1", limits, day);
    await takeLiveRun(c, "s1", limits, day); // refused
    expect(await takeLiveRun(c, "s2", limits, day)).toEqual({ allowed: true, sessionLeft: 1, dayLeft: 0 });
  });

  it("refuses everyone once the daily cap is used, and resets the next day", async () => {
    const c = memoryCounter();
    for (const s of ["a", "b", "c"]) expect((await takeLiveRun(c, s, limits, day)).allowed).toBe(true);
    expect(await takeLiveRun(c, "d", limits, day)).toEqual({ allowed: false, reason: "day" });
    expect((await takeLiveRun(c, "d", limits, new Date("2026-10-29T00:00:01Z"))).allowed).toBe(true);
  });
});

describe("capLimitsFromEnv", () => {
  it("reads the env and falls back on missing or bad values", () => {
    expect(capLimitsFromEnv({ LIVE_RUNS_PER_SESSION: "5", LIVE_RUNS_PER_DAY: "abc" })).toEqual({ perSession: 5, perDay: 100 });
  });
});

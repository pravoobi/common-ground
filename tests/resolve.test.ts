import { describe, expect, it } from "vitest";
import { nameMatches, resolveFromResults } from "../lib/qloo/resolve";
import type { Entity } from "../lib/qloo/schemas";

// Hand-written fixtures shaped like /search results; ids and popularity are made up.
const e = (name: string, popularity: number): Entity => ({ entity_id: `fake-${name}`, name, popularity });

describe("nameMatches", () => {
  it.each([
    ["AR Rahman", "A.R. Rahman"],
    ["Scam 1992", "Scam 1992: The Harshad Mehta Story"],
    ["toit", "Toit"],
    ["Arijit Singh", "Shreya Ghoshal & Arijit Singh"],
    ["Beyonce", "Beyoncé"],
  ])("%s ~ %s", (input, name) => expect(nameMatches(input, name)).toBe(true));

  it.each([
    ["Sid Sriram's new song", "Sidney Bechet and His New Orleans Feetwarmers"],
    ["Kumbalangi Nights", "Boogie Nights"],
    ["Sid Sriram", "Sid"],
    ["", "Anything"],
  ])("%s !~ %s", (input, name) => expect(nameMatches(input, name)).toBe(false));
});

describe("resolveFromResults", () => {
  it("resolves the first matching result", () => {
    const r = resolveFromResults("Kantara", [e("Kantara", 0.9), e("Kantara: A Legend - Chapter 1", 0.6)]);
    expect(r).toMatchObject({ status: "resolved", entity: { name: "Kantara" } });
  });

  it("returns unresolved with the closest name when nothing matches", () => {
    const r = resolveFromResults("Sid Sriram's new song", [e("Sidney Bechet and His New Orleans Feetwarmers", 0.7)]);
    expect(r).toEqual({
      status: "unresolved",
      input: "Sid Sriram's new song",
      closest: "Sidney Bechet and His New Orleans Feetwarmers",
    });
  });

  it("flags ambiguity when a clearly more popular match exists", () => {
    const r = resolveFromResults("Anirudh", [e("Anirudh", 0.7), e("Anirudh Ravichander", 0.9)]);
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.options.map((o) => o.name)).toEqual(["Anirudh", "Anirudh Ravichander"]);
  });

  it("ignores less popular matches such as duets or sequels", () => {
    const r = resolveFromResults("Arijit Singh", [e("Arijit Singh", 0.96), e("Shreya Ghoshal & Arijit Singh", 0.35)]);
    expect(r.status).toBe("resolved");
  });

  it("handles no results", () => {
    expect(resolveFromResults("anything", [])).toEqual({ status: "unresolved", input: "anything", closest: undefined });
  });
});

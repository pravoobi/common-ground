import type { Entity } from "./schemas";

export type Resolution =
  | { status: "resolved"; input: string; entity: Entity }
  /** A more popular match also fits the input: ask which one. */
  | { status: "ambiguous"; input: string; options: Entity[] }
  /** Qloo returned results but none match the input. `closest` is shown, never used. */
  | { status: "unresolved"; input: string; closest?: string };

/** How much more popular another match must be to count as a competing reading. */
const AMBIGUITY_MARGIN = 0.1;

function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Does a Qloo result name plausibly refer to the user's input?
 * "AR Rahman" ~ "A.R. Rahman", "Scam 1992" ~ "Scam 1992: The Harshad Mehta Story".
 */
export function nameMatches(input: string, name: string): boolean {
  const a = normalise(input);
  const b = normalise(name);
  if (!a || !b) return false;
  const compactA = a.replace(/ /g, "");
  const compactB = b.replace(/ /g, "");
  if (compactA === compactB || b.startsWith(a)) return true;
  const nameTokens = new Set(b.split(" "));
  return a.split(" ").every((t) => nameTokens.has(t));
}

/**
 * Guards against Qloo search always returning something (SPIKES.md §2):
 * "Sid Sriram's new song" → "Sidney Bechet…" must come back unresolved.
 */
export function resolveFromResults(input: string, results: Entity[]): Resolution {
  const matching = results.filter((e) => nameMatches(input, e.name));
  if (!matching.length) return { status: "unresolved", input, closest: results[0]?.name };

  const [first] = matching;
  const rivals = matching
    .slice(1)
    .filter((e) => (e.popularity ?? 0) > (first.popularity ?? 0) + AMBIGUITY_MARGIN);
  if (rivals.length) return { status: "ambiguous", input, options: [first, ...rivals] };

  return { status: "resolved", input, entity: first };
}

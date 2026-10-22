// The agent's tools as plain functions over one run's state. No model here: every number comes
// from Qloo or score.ts, and these functions are tested on fixtures (tests/agent-steps.test.ts).
import { applyConstraints, type ConstraintIssue } from "../constraints";
import type { GroupInput } from "../group";
import type { InsightsQuery, QlooClient } from "../qloo/client";
import { nameMatches, resolveFromResults } from "../qloo/resolve";
import type { InsightEntity } from "../qloo/schemas";
import { rankForGroup, type RankedCandidate } from "../score";
import type { AffinityTable, Candidate, Person, PriceLevel } from "../types";

export const TASTE_KINDS = ["artist", "movie", "tv_show", "book", "place", "food_or_drink"] as const;
export type TasteKind = (typeof TASTE_KINDS)[number];

const ENTITY_TYPE: Record<Exclude<TasteKind, "food_or_drink">, string> = {
  artist: "urn:entity:artist",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
  book: "urn:entity:book",
  place: "urn:entity:place",
};

const RESTAURANT_TAG = "urn:tag:category:place:restaurant";
const VEG_TAGS = new Set([
  "urn:tag:dietary_option:qloo:vegetarian",
  "urn:tag:genre:place:restaurant:vegetarian",
  "urn:tag:category:place:vegetarian_restaurant",
]);
const NON_VEG_TAGS = new Set(["urn:tag:category:place:non_vegetarian_restaurant", "urn:tag:genre:place:restaurant:non_vegetarian"]);
/** Chains and takeaways aren't a group outing; Qloo tags them clearly (SPIKES.md §4). */
const FAST_FOOD = /^urn:tag:(genre:place:restaurant:(fast_food|pizza_takeout|pizza_delivery|takeout|fried_chicken_takeaway)|category:place:(fast_food_restaurant|takeout_restaurant|pizza_delivery|pizza_takeout|food_court))$/;
const DEFAULT_POOL_SIZE = 15;
/** Fetched before fast food is dropped, so the pool stays near DEFAULT_POOL_SIZE. */
const FETCH_SIZE = 25;
/** Each person's own favourites added to the pool, so a minority taste gets a say (SPIKES.md §3). */
const PER_PERSON_PICKS = 3;

export interface Signal {
  kind: "entity" | "tag";
  id: string;
  name: string;
}

/** One person's taste, as typed and as resolved. Only `resolved` tastes become Qloo signals. */
export interface Taste {
  personId: string;
  /** Exactly as the person typed it. */
  input: string;
  /** What was searched; the agent may clean the input, e.g. "Sid Sriram" for "Sid Sriram's new song". */
  query: string;
  kind: TasteKind;
  status: "resolved" | "ambiguous" | "unresolved";
  signal?: Signal;
  options?: Signal[];
  closest?: string;
  /** Set when the agent picked between ambiguous options. */
  chosenByAgent?: boolean;
  error?: string;
  /** Earlier lookups of this taste, oldest first: the recovery trail shown in the X-ray. */
  attempts?: { query: string; kind: TasteKind; status: Taste["status"] }[];
}

export type StepName = "resolve" | "overlap" | "plan";
export interface StepEvent {
  step: StepName;
  status: "start" | "done";
  detail?: string;
}

export interface Evidence {
  id: string;
  text: string;
  /** Person the evidence is about; undefined for facts about the place. */
  personId?: string;
}

export interface RunState {
  group: GroupInput;
  qloo: QlooClient;
  tastes: Taste[];
  pool: Map<string, InsightEntity>;
  candidates: Candidate[];
  table: AffinityTable;
  /** candidateId → personId → which of their inputs drove the match (Qloo explainability). */
  contributions: Record<string, Record<string, { entity_id: string; score: number }[]>>;
  scoredPeople: string[];
  ranking: RankedCandidate[];
  meanRanking: RankedCandidate[];
  excluded: { candidate: Candidate; issues: ConstraintIssue[] }[];
  unverified: ConstraintIssue[];
  evidence: Record<string, Evidence[]>;
  /** Chains and takeaways Qloo returned that were left out of the pool. */
  droppedFastFood: string[];
  /** candidateId → "group" and/or the people whose own top places included it. */
  poolSources: Record<string, string[]>;
  onStep?: (e: StepEvent) => void;
}

export function createRunState(group: GroupInput, qloo: QlooClient, onStep?: (e: StepEvent) => void): RunState {
  return {
    group,
    qloo,
    tastes: [],
    pool: new Map(),
    candidates: [],
    table: {},
    contributions: {},
    scoredPeople: [],
    ranking: [],
    meanRanking: [],
    excluded: [],
    unverified: [],
    evidence: {},
    droppedFastFood: [],
    poolSources: {},
    onStep,
  };
}

/** Thrown for a bad tool call; the runner sends the message back to the model as a tool error. */
export class ToolInputError extends Error {}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function person(state: RunState, personId: string) {
  const p = state.group.people.find((x) => x.id === personId);
  if (!p) throw new ToolInputError(`Unknown person_id "${personId}". Known: ${state.group.people.map((x) => x.id).join(", ")}`);
  return p;
}

function people(state: RunState): Person[] {
  return state.group.people.map((p) => ({ id: p.id, label: p.label, constraints: p.constraints }));
}

export function signalsFor(state: RunState, personIds: string[]) {
  const resolved = state.tastes.filter((t) => personIds.includes(t.personId) && t.status === "resolved" && t.signal);
  const ids = (kind: Signal["kind"]) => [...new Set(resolved.filter((t) => t.signal!.kind === kind).map((t) => t.signal!.id))];
  return { entities: ids("entity"), tags: ids("tag") };
}

/** Filters every place query shares (SPIKES.md §4: without them, junk like apartment blocks appears). */
export function placeBase(state: RunState): InsightsQuery {
  const caps = state.group.people.map((p) => p.constraints.maxPriceLevel).filter((x): x is PriceLevel => x !== undefined);
  return {
    type: "urn:entity:place",
    locationQuery: state.group.city,
    tags: [RESTAURANT_TAG],
    priceLevelMin: 1,
    priceLevelMax: caps.length ? Math.min(...caps) : undefined,
    popularityMin: 0.3,
  };
}

// ── resolve_tastes ────────────────────────────────────────────────────────────

export interface ResolveItem {
  person_id: string;
  taste: string;
  query: string;
  kind: TasteKind;
}

const matches = (item: ResolveItem, name: string) => nameMatches(item.query, name) || nameMatches(item.taste, name);

async function resolveOne(state: RunState, item: ResolveItem): Promise<Taste> {
  const base = { personId: item.person_id, input: item.taste, query: item.query, kind: item.kind };
  try {
    if (item.kind === "food_or_drink") {
      const tags = await state.qloo.searchTags(item.query, 5);
      const hit = tags.find((t) => matches(item, t.name));
      return hit
        ? { ...base, status: "resolved", signal: { kind: "tag", id: hit.id, name: hit.name } }
        : { ...base, status: "unresolved", closest: tags[0]?.name };
    }
    const results = await state.qloo.search(item.query, ENTITY_TYPE[item.kind]);
    // A result may match the cleaned query or the taste as typed ("Toit Bengaluru" → "Toit").
    const r = resolveFromResults(item.query, results, (name) => matches(item, name));
    const toSignal = (e: { entity_id: string; name: string }): Signal => ({ kind: "entity", id: e.entity_id, name: e.name });
    if (r.status === "resolved") return { ...base, status: "resolved", signal: toSignal(r.entity) };
    if (r.status === "ambiguous") return { ...base, status: "ambiguous", options: r.options.map(toSignal) };
    return { ...base, status: "unresolved", closest: r.closest };
  } catch (err) {
    // One failed lookup must not break the plan (CLAUDE.md §5).
    return { ...base, status: "unresolved", error: (err as Error).message };
  }
}

export async function resolveTastes(state: RunState, items: ResolveItem[]) {
  for (const item of items) {
    const p = person(state, item.person_id);
    if (!p.tastes.some((t) => same(t, item.taste)))
      throw new ToolInputError(`"${item.taste}" is not one of ${p.label}'s tastes. Pass the taste exactly as given.`);
    const tried = state.tastes.some((t) => t.personId === item.person_id && same(t.input, item.taste));
    // The first lookup uses the words as typed, so a miss and its recovery stay visible.
    if (!tried && !same(item.query, item.taste))
      throw new ToolInputError(`First lookup of "${item.taste}" must use it as typed (query = taste). Rewrite only on a retry.`);
  }
  state.onStep?.({ step: "resolve", status: "start" });
  const results = await Promise.all(items.map((item) => resolveOne(state, item)));
  for (const t of results) {
    const prev = state.tastes.find((x) => x.personId === t.personId && same(x.input, t.input));
    if (prev) t.attempts = [...(prev.attempts ?? []), { query: prev.query, kind: prev.kind, status: prev.status }];
    state.tastes = state.tastes.filter((x) => x !== prev);
    state.tastes.push(t);
  }
  const resolved = state.tastes.filter((t) => t.status === "resolved").length;
  state.onStep?.({ step: "resolve", status: "done", detail: `${resolved} of ${state.tastes.length} tastes matched` });
  return {
    results: results.map((t) => ({
      person_id: t.personId,
      taste: t.input,
      status: t.status,
      matched: t.signal?.name,
      options: t.options?.map((o) => ({ entity_id: o.id, name: o.name })),
      closest_unmatched_result: t.closest,
      error: t.error,
    })),
  };
}

// ── choose_option ─────────────────────────────────────────────────────────────

export function chooseOption(state: RunState, input: { person_id: string; taste: string; entity_id: string }) {
  person(state, input.person_id);
  const t = state.tastes.find((x) => x.personId === input.person_id && same(x.input, input.taste));
  if (!t || t.status !== "ambiguous") throw new ToolInputError(`"${input.taste}" is not an ambiguous taste for ${input.person_id}.`);
  const option = t.options?.find((o) => o.id === input.entity_id);
  if (!option) throw new ToolInputError(`entity_id must be one of the options returned for "${input.taste}".`);
  Object.assign(t, { status: "resolved", signal: option, chosenByAgent: true });
  return { person_id: t.personId, taste: t.input, status: t.status, matched: option.name };
}

// ── find_candidates ───────────────────────────────────────────────────────────

export function toCandidate(e: InsightEntity): Candidate {
  const price = e.properties?.price_level;
  const tagIds = (e.tags ?? []).map((t) => t.id);
  return {
    id: e.entity_id,
    name: e.name,
    priceLevel: price && price >= 1 && price <= 4 ? (price as PriceLevel) : undefined,
    // Only an explicit tag decides; no veg tag means "not known", never "not veg".
    vegFriendly: tagIds.some((id) => VEG_TAGS.has(id)) ? true : tagIds.some((id) => NON_VEG_TAGS.has(id)) ? false : undefined,
    tags: tagIds,
  };
}

export const isFastFood = (e: InsightEntity) => (e.tags ?? []).some((t) => FAST_FOOD.test(t.id));

export async function findCandidates(state: RunState) {
  const { entities, tags } = signalsFor(state, state.group.people.map((p) => p.id));
  if (!entities.length && !tags.length) throw new ToolInputError("No resolved tastes yet. Call resolve_tastes first.");
  state.onStep?.({ step: "overlap", status: "start" });
  const base = placeBase(state);
  // The combined call favours the majority; each person's own top places keep an outlier's favourites in play.
  const [combined, ...own] = await Promise.all([
    state.qloo.insights({ ...base, signalEntities: entities, signalTags: tags, take: FETCH_SIZE }),
    ...state.group.people.map(async (p) => {
      const s = signalsFor(state, [p.id]);
      if (!s.entities.length && !s.tags.length) return [] as InsightEntity[];
      return state.qloo
        .insights({ ...base, signalEntities: s.entities, signalTags: s.tags, take: 10 })
        .catch(() => [] as InsightEntity[]);
    }),
  ]);

  const dropped = new Set<string>();
  const pool = new Map<string, InsightEntity>();
  const sources: Record<string, string[]> = {};
  const add = (e: InsightEntity, source: string) => {
    if (isFastFood(e)) return void dropped.add(e.name);
    if (!pool.has(e.entity_id)) pool.set(e.entity_id, e);
    (sources[e.entity_id] ??= []).push(source);
  };
  for (const e of combined) if (pool.size < DEFAULT_POOL_SIZE || pool.has(e.entity_id)) add(e, "group");
  state.group.people.forEach((p, i) => {
    let added = 0;
    for (const e of own[i]) {
      if (added >= PER_PERSON_PICKS) break;
      if (isFastFood(e)) continue;
      if (!pool.has(e.entity_id)) added++;
      add(e, p.id);
    }
  });

  state.droppedFastFood = [...dropped];
  state.pool = pool;
  state.poolSources = sources;
  state.candidates = [...pool.values()].map(toCandidate);
  return {
    count: state.candidates.length,
    dropped_as_fast_food: state.droppedFastFood,
    candidates: state.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      price_level: c.priceLevel ?? null,
      suggested_by: sources[c.id],
    })),
  };
}

// ── rank_for_group ────────────────────────────────────────────────────────────

const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100));

export async function rankGroup(state: RunState) {
  if (!state.candidates.length) throw new ToolInputError("No candidates yet. Call find_candidates first.");
  const poolIds = state.candidates.map((c) => c.id);
  const scored = state.group.people.filter((p) => {
    const s = signalsFor(state, [p.id]);
    return s.entities.length + s.tags.length > 0;
  });

  // One scoring call per person over the fixed pool (SPIKES.md §3).
  const perPerson = await Promise.all(
    scored.map(async (p) => {
      const s = signalsFor(state, [p.id]);
      try {
        const results = await state.qloo.insights({
          ...placeBase(state),
          signalEntities: s.entities,
          signalTags: s.tags,
          resultEntities: poolIds,
          explain: true,
          take: poolIds.length,
        });
        return { personId: p.id, results };
      } catch {
        return { personId: p.id, results: [] as InsightEntity[] };
      }
    }),
  );

  state.table = Object.fromEntries(poolIds.map((id) => [id, {} as Record<string, number | null>]));
  for (const { personId, results } of perPerson) {
    const byId = new Map(results.map((e) => [e.entity_id, e]));
    for (const id of poolIds) {
      const e = byId.get(id);
      state.table[id][personId] = e?.query?.affinity ?? null;
      const contrib = e?.query?.explainability?.["signal.interests.entities"];
      if (contrib) (state.contributions[id] ??= {})[personId] = contrib;
    }
  }
  state.scoredPeople = scored.map((p) => p.id);

  const { kept, excluded, unverified } = applyConstraints(state.candidates, people(state));
  state.excluded = excluded;
  state.unverified = unverified;
  const keptIds = kept.map((c) => c.id);
  state.ranking = rankForGroup(keptIds, state.scoredPeople, state.table);
  state.meanRanking = rankForGroup(keptIds, state.scoredPeople, state.table, { strategy: "mean" });

  const name = (id: string) => state.pool.get(id)?.name ?? id;
  const top = state.ranking[0];
  const meanTop = state.meanRanking[0];
  state.onStep?.({
    step: "overlap",
    status: "done",
    detail: top ? `${kept.length} places fit everyone; best overlap: ${name(top.candidateId)}` : "No place fits everyone",
  });

  return {
    note: "Scores are each person's percentile within this pool (100 = their favourite here). Never quote them to the group.",
    people_scored: state.scoredPeople,
    people_without_tastes: state.group.people.filter((p) => !state.scoredPeople.includes(p.id)).map((p) => p.id),
    ranking: state.ranking.slice(0, 5).map((r) => ({
      rank: r.rank,
      candidate_id: r.candidateId,
      name: name(r.candidateId),
      percentile_by_person: Object.fromEntries(Object.entries(r.perPerson).map(([k, v]) => [k, pct(v)])),
      least_happy: r.lowest,
      complete: r.complete,
    })),
    averaging_would_pick:
      meanTop && top && meanTop.candidateId !== top.candidateId
        ? {
            name: name(meanTop.candidateId),
            percentile_by_person: Object.fromEntries(Object.entries(meanTop.perPerson).map(([k, v]) => [k, pct(v)])),
          }
        : null,
    excluded: excluded.map((x) => ({ name: x.candidate.name, why: x.issues.map((i) => `${i.personId}: ${i.reason}`) })),
    unverified: unverified.map((i) => `${name(i.candidateId)}: ${i.reason} (for ${i.personId})`),
  };
}

// ── explain_pick ──────────────────────────────────────────────────────────────

const clip = (s: string, n = 180) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function explainPick(state: RunState, input: { candidate_id: string }) {
  const place = state.pool.get(input.candidate_id);
  if (!place || !state.table[input.candidate_id]) throw new ToolInputError("candidate_id must come from rank_for_group.");
  state.onStep?.({ step: "plan", status: "start" });
  const evidence: Evidence[] = [];
  const tagIds = new Set((place.tags ?? []).map((t) => t.id));

  for (const p of state.group.people) {
    let n = 0;
    const add = (text: string) => evidence.push({ id: `${p.id}-${++n}`, text, personId: p.id });
    const mine = state.tastes.filter((t) => t.personId === p.id && t.status === "resolved" && t.signal);
    const contrib = [...(state.contributions[input.candidate_id]?.[p.id] ?? [])].sort((a, b) => b.score - a.score);
    for (const c of contrib.slice(0, 3)) {
      const t = mine.find((x) => x.signal!.id === c.entity_id);
      if (t) add(`Qloo links this place to their taste "${t.input}" (${t.signal!.name})`);
    }
    for (const t of mine.filter((x) => x.signal!.kind === "tag" && tagIds.has(x.signal!.id)))
      add(`The place is tagged "${t.signal!.name}", which matches their "${t.input}"`);
  }

  let f = 0;
  const fact = (text: string | null | undefined) => {
    if (text) evidence.push({ id: `f${++f}`, text: clip(text) });
  };
  const props = place.properties;
  fact(props?.short_description);
  fact(props?.cuisine_description && `Cuisine: ${props.cuisine_description}`);
  fact(props?.ambience_description && `Ambience: ${props.ambience_description}`);
  const dishes = props?.specialty_dishes?.slice(0, 4).map((d) => d.name);
  fact(dishes?.length ? `Known for: ${dishes.join(", ")}` : null);
  const tagNames = (place.tags ?? [])
    .filter((t) => /^urn:tag:(cuisine|specialty_dish|genre:place|amenity|offerings|dietary_option)/.test(t.id))
    .slice(0, 8)
    .map((t) => t.name);
  fact(tagNames.length ? `Tagged: ${tagNames.join(", ")}` : null);
  fact(props?.price_level ? `Price level ${"₹".repeat(props.price_level)}` : null);

  state.evidence[input.candidate_id] = evidence;
  return {
    candidate_id: input.candidate_id,
    name: place.name,
    by_person: Object.fromEntries(
      state.group.people.map((p) => [p.id, evidence.filter((e) => e.personId === p.id).map(({ id, text }) => ({ id, text }))]),
    ),
    place_facts: evidence.filter((e) => !e.personId).map(({ id, text }) => ({ id, text })),
  };
}

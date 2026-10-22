import { z } from "zod";
import type { ConstraintIssue } from "../constraints";
import type { GroupInput } from "../group";
import type { TraceEntry } from "../qloo/client";
import type { RankedCandidate } from "../score";
import type { RunState, StepName, Taste } from "./steps";

/** What the model writes. It holds no scores and no pick: those come from rank_for_group. */
export const PlanOutput = z.object({
  headline: z.string().describe("One short line for the group chat, e.g. 'Saturday: dinner at <place>'. No scores."),
  reasons: z
    .array(
      z.object({
        person_id: z.string(),
        text: z.string().describe("One casual sentence to this friend about why the pick suits them. No numbers."),
        evidence_ids: z.array(z.string()).describe("Ids from explain_pick that this sentence relies on."),
      }),
    )
    .describe("One per person, for the top-ranked place."),
  assumptions: z
    .array(z.object({ person_id: z.string(), text: z.string() }))
    .describe("Each ambiguous taste you chose for, and each taste that could not be matched, in plain words."),
  clarifying_question: z.string().nullable().describe("At most one question for the group, or null."),
  fairness_note: z
    .string()
    .nullable()
    .describe("If averaging would have picked a different place, one sentence on who it would have left out. Else null."),
});
export type PlanOutput = z.infer<typeof PlanOutput>;

export interface PlaceView {
  id: string;
  name: string;
  priceLevel?: number;
  address?: string;
  /** personId → percentile (0–1, null if Qloo gave none) and Qloo's raw affinity. */
  scores: Record<string, { percentile: number | null; affinity: number | null }>;
  leastHappy: string[];
  complete: boolean;
}

export interface Reason {
  personId: string;
  text: string;
  evidence: { id: string; text: string }[];
  /** False when none of the cited ids exist: shown as unverified, never as fact. */
  grounded: boolean;
}

export interface RunRecord {
  id: string;
  mode: "live" | "replay";
  recordedAt: string;
  model: string;
  group: GroupInput;
  tastes: Taste[];
  plan: {
    pick: PlaceView | null;
    runnerUp: PlaceView | null;
    /** What averaging (v0) would have picked, when it differs. */
    averagingPick: PlaceView | null;
    headline: string;
    reasons: Reason[];
    assumptions: { personId: string; text: string }[];
    clarifyingQuestion: string | null;
    fairnessNote: string | null;
  };
  ranking: PlaceView[];
  excluded: { name: string; issues: ConstraintIssue[] }[];
  /** Fast-food chains and takeaways Qloo returned, left out of the pool. */
  droppedFastFood: string[];
  unverified: ConstraintIssue[];
  qlooCalls: TraceEntry[];
  toolCalls: { name: string; ms: number; error?: string }[];
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; turns: number };
  timings: { totalMs: number; steps: { step: StepName; status: "start" | "done"; atMs: number; detail?: string }[] };
}

export function placeView(state: RunState, r: RankedCandidate): PlaceView {
  const e = state.pool.get(r.candidateId);
  return {
    id: r.candidateId,
    name: e?.name ?? r.candidateId,
    priceLevel: e?.properties?.price_level ?? undefined,
    address: e?.properties?.address ?? undefined,
    scores: Object.fromEntries(
      Object.keys(r.perPerson).map((pid) => [pid, { percentile: r.perPerson[pid], affinity: r.raw[pid] }]),
    ),
    leastHappy: r.lowest,
    complete: r.complete,
  };
}

/**
 * Builds the plan from deterministic state plus the model's text. The pick is always the
 * top of the fair ranking; reasons keep only evidence ids that explain_pick actually returned.
 */
export function assemblePlan(state: RunState, output: PlanOutput | null): RunRecord["plan"] {
  const [top, second] = state.ranking;
  const pick = top ? placeView(state, top) : null;
  const meanTop = state.meanRanking[0];
  const averagingPick = meanTop && top && meanTop.candidateId !== top.candidateId ? placeView(state, meanTop) : null;
  const evidence = (top && state.evidence[top.candidateId]) || [];
  const known = new Set(state.group.people.map((p) => p.id));

  const reasons: Reason[] = (output?.reasons ?? [])
    .filter((r) => known.has(r.person_id))
    .map((r) => {
      const cited = evidence.filter(
        (e) => r.evidence_ids.includes(e.id) && (e.personId === undefined || e.personId === r.person_id),
      );
      return { personId: r.person_id, text: r.text, evidence: cited.map(({ id, text }) => ({ id, text })), grounded: cited.length > 0 };
    });

  return {
    pick,
    runnerUp: second ? placeView(state, second) : null,
    averagingPick,
    headline: output?.headline ?? (pick ? `Plan: ${pick.name}` : "No place fits everyone"),
    reasons,
    assumptions: (output?.assumptions ?? []).filter((a) => known.has(a.person_id)).map((a) => ({ personId: a.person_id, text: a.text })),
    clarifyingQuestion: output?.clarifying_question ?? null,
    fairnessNote: averagingPick ? (output?.fairness_note ?? null) : null,
  };
}

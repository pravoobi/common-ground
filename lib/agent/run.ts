import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { randomUUID } from "node:crypto";
import type { Cache } from "../cache";
import type { GroupInput } from "../group";
import { createQlooClient } from "../qloo/client";
import { assemblePlan, PlanOutput, placeView, type RunRecord } from "./record";
import { createRunState, type StepEvent } from "./steps";
import { createTools, type ToolCallLog } from "./tools";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

const SYSTEM = `You plan a group outing for friends using Qloo's taste graph. You never invent scores, places or reasons.

Steps:
1. resolve_tastes: send every taste of every person in one call, with query set to the taste exactly as typed. Pick the kind for each (artist, movie, tv_show, book, place, food_or_drink). Dishes, drinks and cuisines are food_or_drink.
2. For an ambiguous taste, call choose_option with the option that best fits this group (they are in India), and list it in assumptions.
   For an unresolved taste, you may retry once with a cleaner query (e.g. just the artist's name) or another kind. If it still fails, leave it out and list it in assumptions. Never use the "closest unmatched result".
3. find_candidates, then rank_for_group.
4. explain_pick for the top-ranked candidate only.
5. Answer with the plan JSON.

Writing rules:
- The pick is the top of rank_for_group. Do not choose a different place.
- One reason per person: a casual, warm sentence addressed to them, as a friend would post in a WhatsApp group. Cite the evidence ids it relies on.
- Use only explain_pick evidence. If a person has no personal evidence, say honestly that it's a fair middle ground for them and cite a place fact.
- Never quote numbers, percentiles or scores.
- fairness_note: only if rank_for_group reports averaging_would_pick; name who averaging would have left out, without numbers.
- clarifying_question: only if an ambiguous or unresolved taste really matters; otherwise null. At most one.`;

export interface RunOptions {
  anthropic?: Anthropic;
  qloo?: { baseUrl: string; apiKey: string; cache?: Cache };
  model?: string;
  onStep?: (e: StepEvent) => void;
}

export async function runAgent(group: GroupInput, options: RunOptions = {}): Promise<RunRecord> {
  const started = Date.now();
  const model = options.model ?? process.env.AGENT_MODEL ?? DEFAULT_MODEL;
  const anthropic = options.anthropic ?? new Anthropic();
  const qloo = createQlooClient({
    baseUrl: options.qloo?.baseUrl ?? process.env.QLOO_BASE_URL ?? "",
    apiKey: options.qloo?.apiKey ?? process.env.QLOO_API_KEY ?? "",
    cache: options.qloo?.cache,
  });

  const steps: RunRecord["timings"]["steps"] = [];
  const state = createRunState(group, qloo, (e) => {
    steps.push({ ...e, atMs: Date.now() - started });
    options.onStep?.(e);
  });
  const toolCalls: ToolCallLog[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, turns: 0 };

  const runner = anthropic.beta.messages.toolRunner({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(PlanOutput) },
    fallbacks: "default",
    betas: ["server-side-fallback-2026-07-01"],
    max_iterations: 12,
    system: SYSTEM,
    tools: createTools(state, toolCalls),
    messages: [{ role: "user", content: `Plan for this group:\n${JSON.stringify(group, null, 2)}` }],
  });

  let last: Anthropic.Beta.BetaMessage | undefined;
  for await (const message of runner) {
    last = message;
    usage.turns++;
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
  }

  let output: PlanOutput | null = null;
  if (last?.stop_reason === "end_turn") {
    const text = last.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = PlanOutput.safeParse(safeJson(text));
    if (parsed.success) output = parsed.data;
  }
  state.onStep?.({ step: "plan", status: "done", detail: output ? "Plan written" : `No plan text (${last?.stop_reason ?? "no reply"})` });

  return {
    id: randomUUID(),
    mode: "live",
    recordedAt: new Date().toISOString(),
    model,
    group,
    tastes: state.tastes,
    plan: assemblePlan(state, output),
    ranking: state.ranking.slice(0, 5).map((r) => placeView(state, r)),
    excluded: state.excluded.map((x) => ({ name: x.candidate.name, issues: x.issues })),
    unverified: state.unverified,
    droppedFastFood: state.droppedFastFood,
    qlooCalls: qloo.trace,
    toolCalls,
    usage,
    timings: { totalMs: Date.now() - started, steps },
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

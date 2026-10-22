import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { chooseOption, explainPick, findCandidates, rankGroup, resolveTastes, TASTE_KINDS, type RunState } from "./steps";

export interface ToolCallLog {
  name: string;
  ms: number;
  error?: string;
}

/** The agent's Qloo tools, bound to one run's state. Results are JSON strings. */
export function createTools(state: RunState, log: ToolCallLog[]) {
  const timed =
    <I>(name: string, fn: (input: I) => unknown) =>
    async (input: I) => {
      const started = Date.now();
      try {
        const out = await fn(input);
        log.push({ name, ms: Date.now() - started });
        return JSON.stringify(out);
      } catch (err) {
        log.push({ name, ms: Date.now() - started, error: (err as Error).message });
        throw err;
      }
    };

  return [
    betaZodTool({
      name: "resolve_tastes",
      description:
        "Match people's free-text tastes to Qloo entities (artists, films, shows, books, places) or Qloo tags (food and drink). " +
        "Send every taste for every person in one call. Returns resolved, ambiguous (with options) or unresolved (with the closest " +
        "unrelated result, which must not be used). You may call again for specific tastes with a cleaned-up query or a different kind.",
      strict: true,
      inputSchema: z.object({
        items: z.array(
          z.object({
            person_id: z.string(),
            taste: z.string().describe("The taste exactly as the person typed it."),
            query: z.string().describe("What to search for: usually the taste itself, or its core name."),
            kind: z.enum(TASTE_KINDS),
          }),
        ),
      }),
      run: timed("resolve_tastes", (input: { items: Parameters<typeof resolveTastes>[1] }) => resolveTastes(state, input.items)),
    }),
    betaZodTool({
      name: "choose_option",
      description: "Resolve an ambiguous taste by picking one of the options resolve_tastes returned for it. Record it in assumptions.",
      strict: true,
      inputSchema: z.object({ person_id: z.string(), taste: z.string(), entity_id: z.string() }),
      run: timed("choose_option", (input: Parameters<typeof chooseOption>[1]) => chooseOption(state, input)),
    }),
    betaZodTool({
      name: "find_candidates",
      description:
        "Get candidate restaurants in the group's city from Qloo, using every resolved taste of every person as signals. " +
        "Price caps are applied. Call after tastes are resolved.",
      strict: true,
      inputSchema: z.object({}),
      run: timed("find_candidates", () => findCandidates(state, {})),
    }),
    betaZodTool({
      name: "rank_for_group",
      description:
        "Score every candidate for each person with Qloo, apply hard constraints (veg, budget), and rank by fairness: " +
        "the place whose least-happy person is happiest wins. Also reports what averaging would have picked.",
      strict: true,
      inputSchema: z.object({}),
      run: timed("rank_for_group", () => rankGroup(state)),
    }),
    betaZodTool({
      name: "explain_pick",
      description:
        "Evidence for why a candidate suits each person (which of their tastes Qloo linked it to) plus facts about the place. " +
        "Reasons may only use this evidence, cited by id.",
      strict: true,
      inputSchema: z.object({ candidate_id: z.string() }),
      run: timed("explain_pick", (input: { candidate_id: string }) => explainPick(state, input)),
    }),
  ];
}

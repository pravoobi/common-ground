import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { GroupInput } from "../group";
import { DEFAULT_MODEL } from "./run";

/**
 * The "without Qloo" baseline: the same model, the same group, the same writing rules,
 * and no tools. Generated once per sample and stored; labelled as such wherever it's shown.
 */
const SYSTEM = `You plan a group outing for friends. Pick one real restaurant in the group's city that suits everyone.

Writing rules:
- One reason per person: a casual, warm sentence addressed to them, as a friend would post in a WhatsApp group.
- Never quote numbers, percentiles or scores.
- clarifying_question: only if something really matters; otherwise null. At most one.`;

export const BaselineOutput = z.object({
  place_name: z.string().describe("The restaurant's name, as it is commonly known."),
  area: z.string().describe("Neighbourhood in the city."),
  headline: z.string().describe("One short line for the group chat. No scores."),
  reasons: z.array(z.object({ person_id: z.string(), text: z.string() })).describe("One per person."),
  clarifying_question: z.string().nullable(),
});
export type BaselineOutput = z.infer<typeof BaselineOutput>;

export interface BaselineRun {
  model: string;
  generatedAt: string;
  output: BaselineOutput;
  usage: { inputTokens: number; outputTokens: number };
  ms: number;
}

export async function runBaseline(group: GroupInput, anthropic = new Anthropic(), model = process.env.AGENT_MODEL ?? DEFAULT_MODEL): Promise<BaselineRun> {
  const started = Date.now();
  const message = await anthropic.beta.messages.create({
    model,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(BaselineOutput) },
    fallbacks: "default",
    betas: ["server-side-fallback-2026-07-01"],
    system: SYSTEM,
    messages: [{ role: "user", content: `Plan for this group:\n${JSON.stringify(group, null, 2)}` }],
  });
  if (message.stop_reason !== "end_turn") throw new Error(`Baseline stopped with ${message.stop_reason}`);
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const output = BaselineOutput.parse(JSON.parse(text));
  return {
    model,
    generatedAt: new Date().toISOString(),
    output,
    usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    ms: Date.now() - started,
  };
}

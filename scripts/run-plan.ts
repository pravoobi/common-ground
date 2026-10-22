// Runs the agent once, live, on a group file: `npm run plan -- data/groups/college-friends.json`.
// Spends real Qloo calls and model tokens. The full record (it contains Qloo data) goes to the
// gitignored .qloo-raw/ folder; only a summary is printed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { runAgent } from "../lib/agent/run";
import { getCache } from "../lib/cache";
import { GroupInput } from "../lib/group";

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run plan -- <group.json>");
const group = GroupInput.parse(JSON.parse(readFileSync(file, "utf8")));

async function main() {
const record = await runAgent(group, {
  qloo: { baseUrl: process.env.QLOO_BASE_URL ?? "", apiKey: process.env.QLOO_API_KEY ?? "", cache: getCache() },
  onStep: (e) => console.log(`[${e.step}] ${e.status}${e.detail ? ": " + e.detail : ""}`),
});

mkdirSync(".qloo-raw/runs", { recursive: true });
const out = `.qloo-raw/runs/${basename(file, ".json")}-${record.recordedAt.replace(/[:.]/g, "-")}.json`;
writeFileSync(out, JSON.stringify(record, null, 2));

const { plan, usage, timings, qlooCalls, toolCalls } = record;
console.log("\nTastes:");
for (const t of record.tastes) console.log(`  ${t.personId}: "${t.input}" → ${t.status}${t.signal ? ` (${t.signal.name})` : ""}`);
console.log(`\n${plan.headline}`);
for (const r of plan.reasons) console.log(`  ${r.personId}${r.grounded ? "" : " [UNGROUNDED]"}: ${r.text} [${r.evidence.map((e) => e.id).join(", ")}]`);
if (plan.fairnessNote) console.log(`Fairness: ${plan.fairnessNote}`);
for (const a of plan.assumptions) console.log(`Assumed (${a.personId}): ${a.text}`);
if (plan.clarifyingQuestion) console.log(`Question: ${plan.clarifyingQuestion}`);
console.log(`\nTools: ${toolCalls.map((t) => `${t.name}${t.error ? "!" : ""} ${t.ms}ms`).join(" → ")}`);
const cached = qlooCalls.filter((c) => c.status === "cache").length;
console.log(`Qloo: ${qlooCalls.length} calls (${cached} from cache) · Model: ${usage.turns} turns, ${usage.inputTokens} in / ${usage.outputTokens} out tokens · ${(timings.totalMs / 1000).toFixed(1)}s`);
console.log(`Saved ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

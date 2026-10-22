import type { RunRecord } from "../lib/agent/record";

/** Console summary of a run: names and counts, no raw Qloo payloads. */
export function printRecord(record: RunRecord) {
  const { plan, usage, timings, qlooCalls, toolCalls } = record;
  console.log("\nTastes:");
  for (const t of record.tastes)
    console.log(
      `  ${t.personId}: "${t.input}" → ${t.status}${t.signal ? ` (${t.signal.name})` : ""}${t.attempts?.length ? ` after retry` : ""}${t.chosenByAgent ? " (agent chose)" : ""}`,
    );
  console.log(`\n${plan.headline}`);
  for (const r of plan.reasons) console.log(`  ${r.personId}${r.grounded ? "" : " [UNGROUNDED]"}: ${r.text} [${r.evidence.map((e) => e.id).join(", ")}]`);
  if (plan.averagingPick) console.log(`Averaging would pick: ${plan.averagingPick.name}. ${plan.fairnessNote ?? ""}`);
  for (const a of plan.assumptions) console.log(`Assumed (${a.personId}): ${a.text}`);
  if (plan.clarifyingQuestion) console.log(`Question: ${plan.clarifyingQuestion}`);
  if (record.droppedFastFood.length) console.log(`Dropped as fast food: ${record.droppedFastFood.join(", ")}`);
  console.log(`\nTools: ${toolCalls.map((t) => `${t.name}${t.error ? "!" : ""} ${t.ms}ms`).join(" → ")}`);
  const cached = qlooCalls.filter((c) => c.status === "cache").length;
  console.log(
    `Qloo: ${qlooCalls.length} calls (${cached} from cache) · ${record.model}: ${usage.turns} turns, ${usage.inputTokens} in / ${usage.outputTokens} out tokens · ${(timings.totalMs / 1000).toFixed(1)}s`,
  );
}

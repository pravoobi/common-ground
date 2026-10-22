// Records a sample group's run into Redis for replay: `npm run record -- college-friends`.
// Spends real Qloo calls and model tokens once; every page view after that is free.
// Never edit a recording by hand: if a run is bad, fix the code and record again.
import { mkdirSync, writeFileSync } from "node:fs";
import { runAgent } from "../lib/agent/run";
import { getCache } from "../lib/cache";
import { saveReplay } from "../lib/replays";
import { getSample, SAMPLES } from "../lib/samples";
import { printRecord } from "./print-record";

async function main() {
  const sample = getSample(process.argv[2] ?? "");
  if (!sample) throw new Error(`Usage: npm run record -- <${SAMPLES.map((s) => s.id).join(" | ")}>`);
  const record = await runAgent(sample.group, {
    qloo: { baseUrl: process.env.QLOO_BASE_URL ?? "", apiKey: process.env.QLOO_API_KEY ?? "", cache: getCache() },
    onStep: (e) => console.log(`[${e.step}] ${e.status}${e.detail ? ": " + e.detail : ""}`),
  });
  printRecord(record);
  if (!record.plan.pick || record.plan.reasons.length === 0) throw new Error("Run produced no plan; not saving it.");
  await saveReplay(sample.id, record);
  mkdirSync(".qloo-raw/runs", { recursive: true });
  writeFileSync(`.qloo-raw/runs/replay-${sample.id}.json`, JSON.stringify(record, null, 2));
  console.log(`\nSaved replay:run:${sample.id} to Redis.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

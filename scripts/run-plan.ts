// Runs the agent once, live, on a group file: `npm run plan -- data/groups/college-friends.json`.
// Spends real Qloo calls and model tokens. The full record (it contains Qloo data) goes to the
// gitignored .qloo-raw/ folder; only a summary is printed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { runAgent } from "../lib/agent/run";
import { getCache } from "../lib/cache";
import { GroupInput } from "../lib/group";
import { printRecord } from "./print-record";

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

  printRecord(record);
  console.log(`Saved ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

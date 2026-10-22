// Runs only the Qloo steps for a group (no model): `npm run probe -- data/groups/x.json`.
// Shows how tastes resolve and whether averaging and fairness pick different places, before
// spending model tokens on a recording. Ambiguous tastes take the first option. Prints names only.
import { readFileSync } from "node:fs";
import { chooseOption, createRunState, findCandidates, rankGroup, resolveTastes, type TasteKind } from "../lib/agent/steps";
import { getCache } from "../lib/cache";
import { GroupInput } from "../lib/group";
import { createQlooClient } from "../lib/qloo/client";

const FOOD = /bdosab|idli|biryani|coffee|sushi|pizza|kebab|bhaji|chai|thali|momo/i;

async function main() {
  const file = process.argv[2];
  const kinds = JSON.parse(process.argv[3]?.startsWith("{") ? process.argv[3] : "{}") as Record<string, TasteKind>;
  const group = GroupInput.parse(JSON.parse(readFileSync(file, "utf8")));
  const qloo = createQlooClient({ baseUrl: process.env.QLOO_BASE_URL ?? "", apiKey: process.env.QLOO_API_KEY ?? "", cache: getCache() });
  const state = createRunState(group, qloo);
  await resolveTastes(
    state,
    group.people.flatMap((p) =>
      p.tastes.map((t) => ({ person_id: p.id, taste: t, query: t, kind: kinds[t] ?? (FOOD.test(t) ? "food_or_drink" : "artist") })),
    ),
  );
  for (const t of state.tastes) {
    if (t.status === "ambiguous") chooseOption(state, { person_id: t.personId, taste: t.input, entity_id: t.options![0].id });
    console.log(`  ${t.personId}: "${t.input}" (${t.kind}) → ${t.status}${t.signal ? ` ${t.signal.name}` : ""}${t.options ? ` [options: ${t.options.map((o) => o.name).join(" | ")}]` : ""}`);
  }
  await findCandidates(state);
  if (process.argv.includes("--tags"))
    for (const e of state.pool.values())
      console.log(`  [pool] ${e.name} · price ${e.properties?.price_level ?? "?"} · pop ${e.popularity?.toFixed(2)} · ${(e.tags ?? []).map((t) => t.id.replace("urn:tag:", "")).filter((t) => /^(genre|category)/.test(t)).join(" ")}`);
  const out = await rankGroup(state);
  console.log("\nFair ranking:");
  for (const r of out.ranking) console.log(`  ${r.rank}. ${r.name} ${JSON.stringify(r.percentile_by_person)} least happy: ${r.least_happy.join(",")}`);
  console.log(`Averaging would pick: ${out.averaging_would_pick ? `${out.averaging_would_pick.name} ${JSON.stringify(out.averaging_would_pick.percentile_by_person)}` : "same place"}`);
  console.log(`Excluded: ${out.excluded.length} · unverified: ${out.unverified.length} · Qloo calls: ${qloo.trace.length} (${qloo.trace.filter((c) => c.status === "cache").length} cached)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

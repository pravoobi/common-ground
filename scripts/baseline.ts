// Generates the "without Qloo" baseline for a recorded sample: `npm run baseline -- birthday-with-amma`.
// Same model, same group, same writing rules, no tools. Then both picks are scored for each person
// with Qloo over the same pool, and the comparison is stored in Redis next to the replay.
import { applyConstraints } from "../lib/constraints";
import { runBaseline } from "../lib/agent/baseline";
import { findPlaceInCity, scorePicks, type Comparison } from "../lib/agent/compare";
import { createRunState, findCandidates, rankGroup, toCandidate } from "../lib/agent/steps";
import { getCache } from "../lib/cache";
import { createQlooClient } from "../lib/qloo/client";
import type { InsightEntity } from "../lib/qloo/schemas";
import { loadComparison, loadReplay, saveComparison } from "../lib/replays";
import { getSample, SAMPLES } from "../lib/samples";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : String(Math.round(x * 100)));

async function main() {
  const sample = getSample(process.argv[2] ?? "");
  if (!sample) throw new Error(`Usage: npm run baseline -- <${SAMPLES.map((s) => s.id).join(" | ")}>`);
  const record = await loadReplay(sample.id);
  if (!record?.plan.pick) throw new Error(`No recorded plan for ${sample.id}; run npm run record first.`);

  // --rescore reuses the stored baseline text and only redoes the Qloo matching and scoring.
  const stored = process.argv.includes("--rescore") ? await loadComparison(sample.id) : null;
  if (process.argv.includes("--rescore") && !stored) throw new Error("Nothing stored to rescore.");
  const baseline = stored
    ? { model: stored.model, generatedAt: stored.generatedAt, output: stored.baseline.output, usage: stored.baseline.usage, ms: stored.baseline.ms }
    : await runBaseline(sample.group);
  const { output } = baseline;
  console.log(`Without Qloo (${baseline.model}): ${output.place_name}, ${output.area}`);
  for (const r of output.reasons) console.log(`  ${r.person_id}: ${r.text}`);

  // Rebuild the recorded run's pool from the same tastes (cached Qloo responses).
  const qloo = createQlooClient({ baseUrl: process.env.QLOO_BASE_URL ?? "", apiKey: process.env.QLOO_API_KEY ?? "", cache: getCache() });
  const state = createRunState(sample.group, qloo);
  state.tastes = record.tastes;
  await findCandidates(state);
  await rankGroup(state);

  const found = await findPlaceInCity(qloo, output.place_name, sample.group.city, output.area);
  const people = sample.group.people.map((p) => ({ id: p.id, label: p.label, constraints: p.constraints }));
  const issues = found ? applyConstraints([toCandidate(found as InsightEntity)], people) : null;
  const picks = [{ id: record.plan.pick.id, name: record.plan.pick.name }];
  if (found) picks.push({ id: found.entity_id, name: found.name });
  const [qlooScore, baselineScore] = await scorePicks(state, picks);

  const comparison: Comparison = {
    sampleId: sample.id,
    generatedAt: baseline.generatedAt,
    model: baseline.model,
    baseline: { output, usage: baseline.usage, ms: baseline.ms },
    baselinePlace: found
      ? {
          id: found.entity_id,
          name: found.name,
          address: found.properties?.address ?? undefined,
          priceLevel: found.properties?.price_level ?? undefined,
        }
      : null,
    baselineIssues: issues
      ? [
          ...issues.excluded.flatMap((x) => x.issues.map((i) => ({ personId: i.personId, reason: i.reason, verified: true }))),
          ...issues.unverified.map((i) => ({ personId: i.personId, reason: i.reason, verified: false })),
        ]
      : [],
    scores: { qloo: qlooScore, baseline: baselineScore ?? null },
    poolSize: state.candidates.length,
  };

  console.log(`\nMatched in Qloo: ${found ? `${found.name} (${found.properties?.address ?? "no address"})` : "no matching place in the city"}`);
  for (const i of comparison.baselineIssues) console.log(`  ${i.verified ? "BREAKS" : "unverified"} for ${i.personId}: ${i.reason}`);
  for (const s of [qlooScore, baselineScore].filter(Boolean))
    console.log(
      `  ${s!.name}: ${Object.entries(s!.perPerson).map(([k, v]) => `${k} ${pct(v.percentile)}`).join(", ")} | least happy ${pct(s!.min)} | mean ${pct(s!.mean)}`,
    );
  await saveComparison(comparison);
  console.log(`\nSaved replay:comparison:${sample.id} to Redis.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

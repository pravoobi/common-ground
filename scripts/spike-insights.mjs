import { qloo } from "./qloo-lib.mjs";

async function resolve(text, type) {
  const r = await qloo("search", { query: text, types: `urn:entity:${type}`, take: 1 });
  return r.body.results[0].entity_id;
}
const people = {
  asha: [["AR Rahman", "artist"], ["Kantara", "movie"], ["Kumbalangi Nights", "movie"]],
  ravi: [["Diljit Dosanjh", "artist"], ["RRR", "movie"], ["Scam 1992", "tv_show"]],
  meera: [["Prateek Kuhad", "artist"], ["Zindagi Na Milegi Dobara", "movie"], ["Panchayat", "tv_show"]],
};
const ids = {};
for (const [p, list] of Object.entries(people)) ids[p] = await Promise.all(list.map(([t, ty]) => resolve(t, ty)));

const base = {
  "filter.type": "urn:entity:place",
  "filter.location.query": "Bengaluru",
  "filter.tags": "urn:tag:genre:place:restaurant",
  "feature.explainability": "true",
  take: 8,
};

// A: one call per person
const perPerson = {};
for (const p of Object.keys(people)) {
  const r = await qloo("v2/insights", { ...base, "signal.interests.entities": ids[p].join(",") });
  const ents = r.body?.results?.entities ?? [];
  perPerson[p] = ents;
  console.log(`\n[${p}] ${r.status} ${r.ms}ms, ${ents.length} results`);
  if (p === "asha" && ents[0]) {
    console.log("entity keys:", Object.keys(ents[0]).join(", "));
    console.log("query:", JSON.stringify(ents[0].query).slice(0, 600));
    console.log("properties keys:", Object.keys(ents[0].properties ?? {}).join(", "));
    console.log("top-level keys:", Object.keys(r.body).join(", "), "| results keys:", Object.keys(r.body.results).join(", "));
  }
  for (const e of ents) console.log(`  ${e.name} | affinity=${e.query?.affinity?.toFixed?.(3)} pop=${e.popularity?.toFixed(2)} price=${e.properties?.price_level ?? "-"}`);
}

// B: combined group signals
const all = Object.values(ids).flat();
const g = await qloo("v2/insights", { ...base, "signal.interests.entities": all.join(","), take: 10 });
const group = g.body?.results?.entities ?? [];
console.log(`\n[group combined] ${g.status} ${g.ms}ms`);
for (const e of group) console.log(`  ${e.name} | affinity=${e.query?.affinity?.toFixed?.(3)} expl=${JSON.stringify(e.query?.explainability)?.slice(0, 160)}`);

// C: score the group's candidate pool for each person via filter.results.entities
const pool = group.map((e) => e.entity_id);
for (const p of Object.keys(people)) {
  const r = await qloo("v2/insights", {
    ...base, "signal.interests.entities": ids[p].join(","), "filter.results.entities": pool.join(","), take: pool.length,
  });
  const ents = r.body?.results?.entities ?? [];
  console.log(`\n[score pool for ${p}] ${r.status} ${r.ms}ms, ${ents.length}/${pool.length} scored`);
  for (const e of ents) console.log(`  ${e.name} | affinity=${e.query?.affinity?.toFixed?.(3)}`);
  if (!ents.length) console.log("  body:", JSON.stringify(r.body).slice(0, 300));
}

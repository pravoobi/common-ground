import { qloo } from "./qloo-lib.mjs";
const asha = "9986F595-C20E-4EBB-828F-55E7DEEBE448"; // A.R. Rahman (from spike 2)
const show = (label, r) => {
  const ents = r.body?.results?.entities ?? [];
  console.log(`\n[${label}] ${r.status} ${r.ms}ms ${ents.length} results`);
  for (const e of ents) console.log(`  ${e.name} | ${e.subtype ?? e.type} | aff=${e.query?.affinity?.toFixed(3)} | price=${e.properties?.price_level ?? "-"} | veg=${(e.tags ?? []).some((t) => /vegetarian/.test(t.tag_id ?? t.id)) ? "y" : "?"} | ${e.properties?.geocode?.city ?? ""}`);
  if (!ents.length) console.log("  ", JSON.stringify(r.body).slice(0, 300));
};
const base = { "filter.type": "urn:entity:place", "signal.interests.entities": asha, take: 8 };
show("category tag, Bengaluru", await qloo("v2/insights", { ...base, "filter.location.query": "Bengaluru", "filter.tags": "urn:tag:category:place:restaurant" }));
show("category tag + price + popularity>=0.3, Bengaluru", await qloo("v2/insights", { ...base, "filter.location.query": "Bengaluru", "filter.tags": "urn:tag:category:place:restaurant", "filter.price_level.min": 1, "filter.popularity.min": 0.3 }));
for (const city of ["Mumbai", "Delhi", "Chennai", "Hyderabad"])
  show(`category tag + price, ${city}`, await qloo("v2/insights", { ...base, "filter.location.query": city, "filter.tags": "urn:tag:category:place:restaurant", "filter.price_level.min": 1, take: 5 }));

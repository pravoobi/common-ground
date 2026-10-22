import { qloo } from "./qloo-lib.mjs";
for (const q of ["restaurant", "vegetarian", "biryani", "filter coffee", "south indian", "brewery"]) {
  const r = await qloo("v2/tags", { "filter.query": q, take: 6 });
  const tags = r.body?.results?.tags ?? r.body?.results ?? [];
  console.log(`${r.status} ${r.ms}ms | ${q} -> ${Array.isArray(tags) ? tags.map((t) => `${t.name} <${t.id ?? t.tag_id}>`).join(" | ") : JSON.stringify(r.body).slice(0, 300)}`);
}

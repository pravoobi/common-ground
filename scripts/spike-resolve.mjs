import { qloo } from "./qloo-lib.mjs";

const inputs = [
  ["AR Rahman", "artist"], ["Arijit Singh", "artist"], ["Sid Sriram", "artist"], ["Anirudh", "artist"],
  ["Prateek Kuhad", "artist"], ["Ilaiyaraaja", "artist"], ["Diljit Dosanjh", "artist"],
  ["Kantara", "movie"], ["RRR", "movie"], ["3 Idiots", "movie"], ["Kumbalangi Nights", "movie"],
  ["Zindagi Na Milegi Dobara", "movie"], ["Super Deluxe", "movie"],
  ["Panchayat", "tv_show"], ["Scam 1992", "tv_show"],
  ["Toit", "place"], ["MTR", "place"], ["Vidyarthi Bhavan", "place"],
  ["filter coffee", "place"], ["biryani", "place"], ["Sid Sriram's new song", "artist"],
];

const times = [];
for (const [text, type] of inputs) {
  const r = await qloo("search", { query: text, types: `urn:entity:${type}`, take: 3 });
  times.push(r.ms);
  const top = (r.body.results ?? []).map((e) => {
    const g = e.properties?.geocode;
    const where = g ? ` [${g.city ?? g.name ?? ""}${g.country_code ? ", " + g.country_code : ""}]` : "";
    return `${e.name}${where} pop=${e.popularity?.toFixed(2)}`;
  });
  console.log(`${r.status} ${r.ms}ms | ${text} (${type}) -> ${top.join(" | ") || "NO RESULTS"}`);
}
times.sort((a, b) => a - b);
console.log(`latency median ${times[times.length >> 1]}ms, max ${times.at(-1)}ms`);

// Shared spike helper. Key stays server-side; raw bodies go to gitignored .qloo-raw/.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

export async function qloo(path, params) {
  const url = new URL(path, env.QLOO_BASE_URL.replace(/\/?$/, "/"));
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, String(v));
  const t0 = performance.now();
  const res = await fetch(url, { headers: { "X-Api-Key": env.QLOO_API_KEY } });
  const ms = Math.round(performance.now() - t0);
  const text = await res.text();
  mkdirSync(".qloo-raw", { recursive: true });
  writeFileSync(`.qloo-raw/${createHash("sha1").update(url.toString()).digest("hex").slice(0, 10)}.json`, text);
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  await new Promise((r) => setTimeout(r, 120)); // stay under 10 req/s
  return { status: res.status, ms, body, url: url.pathname + url.search };
}

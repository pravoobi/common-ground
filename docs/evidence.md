# Evidence

## v0 → v1 (averaging vs. fairness)
_Pending: needs a real Qloo run on a sample group._

## Failure → recovery
- 2026-10-22, spike 2: `/search` always returns a top result. "Sid Sriram's new song" resolved to "Sidney Bechet and His New Orleans Feetwarmers"; "filter coffee" as a place resolved to a café in Pisa. Fix planned: name-match guard → unresolved → one clarifying question; food terms go through `/v2/tags`.
- 2026-10-22, first agent run: the agent "helped" by searching "Toit Bengaluru"; Qloo returned "Toit" but the name guard needed every query word in the name, so Toit came back unresolved. It also pre-cleaned "Anirudh" → "Anirudh Ravichander" and "Sid Sriram's new song" → "Sid Sriram", hiding the ambiguity. Fix: a result may match the taste as typed or the query; the first lookup must use the taste as typed (enforced in code), rewrites only on retry, every attempt kept.
- 2026-10-22, second agent run (after the fix): "Anirudh" → ambiguous → agent chose Anirudh Ravichander and listed it as an assumption; "Sid Sriram's new song" → unresolved → retried as "Sid Sriram" → resolved, listed as an assumption. 12/12 tastes resolved. The pick (The 13th Floor) has no veg tag, so Asha's veg constraint was reported as unverified and the agent asked her one clarifying question instead of claiming it's veg-friendly.
- 2026-10-22, spike 3: Qloo affinities for a person's pool cluster in 0.87–0.94, so raw maximin would pick on noise. Fix planned: per-person percentile normalisation before maximin.

## Measured numbers (dated)
| Date | Metric | Value | How measured |
|---|---|---|---|
| 2026-10-22 | `/search` latency | median 254 ms, max 728 ms | 21 calls, spike 2 |
| 2026-10-22 | Entity resolution hit rate (named entities) | 17/18 top-1 correct | spike 2 |
| 2026-10-22 | `/v2/insights` latency | 0.4–1.2 s | spikes 3–4 |
| 2026-10-22 | Per-person scoring coverage | 10/10 candidates scored for each of 3 people | `filter.results.entities`, spike 3 |
| 2026-10-22 | Qloo rate limits | 50,000/month, 10/s | response headers |
| 2026-10-22 | Live plan, 4 people, 12 tastes (cold) | 37.5 s · 18 Qloo calls · 6 model turns · 30.6k in / 1.5k out tokens | `npm run plan`, college-friends sample |
| 2026-10-22 | Same group, rerun | 29.2 s · 18 Qloo calls, 9 from Upstash cache · 32.1k in / 1.6k out tokens | same |
| 2026-10-22 | `/search` latency under 12 parallel lookups | 1.5–3.8 s each (vs 254 ms one at a time) | agent run trace |

## Lessons we paid for
- Invalid Qloo params are silently ignored: a typo looks like "no effect", not an error.
- `filter.tags=…restaurant` alone lets in cities, apartments and hotels in Bengaluru; `filter.price_level.min=1` + `filter.popularity.min=0.3` cleans it up.
- Qloo terms forbid storing their response data in a public repo → replays moved to private Redis, tests use hand-written fixtures.

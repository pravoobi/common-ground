# Evidence

## v0 → v1 (averaging vs. fairness)
2026-10-22, recorded sample "Flatmates taking Amma out for her birthday" (4 people, real Qloo scores, percentile within the pool):

| | Kabir | Tanvi | Sameer | Amma | Least happy | Mean |
|---|---|---|---|---|---|---|
| **v0 averaging → The 13th Floor** | 74 | 52 | 100 | 87 | 52 (Tanvi) | 78 |
| **v1 fairness → SkyDeck by Sherlock's** | 87 | 57 | 61 | 83 | 57 (Tanvi) | 72 |

Averaging chases Sameer's 100 and gives Tanvi her weaker match; fairness lifts the least-happy friend and Kabir, at the cost of Sameer's favourite. The gap is modest, and we report it as measured, not tuned.

**What it took to see any disagreement at all:** with the candidate pool from one combined Qloo call, averaging and fairness agreed on all 3 sample groups (probe, 2026-10-22). The combined call is dominated by the majority's tastes, so places only the outlier loves never enter the pool. Fix: add each person's own top 3 places to the pool. After that, the birthday group (three bar-lovers + Amma) split as above. College friends and the couple still agree, which is the honest result when tastes broadly overlap.

## Without Qloo vs with Qloo
2026-10-22. Same model (`claude-sonnet-5-5`), same group, same writing rules, no tools (`npm run baseline`). Both picks scored per friend with Qloo over the same pool (percentile, 100 = best match in the pool).

| Sample | Without Qloo | Least happy friend | With Qloo | Least happy friend |
|---|---|---|---|---|
| College friends (4) | Meghana Foods, Indiranagar | 0 | The 13th Floor | 71 |
| Couple (2) | Matsuri | 0 (Nisha 100, Arjun 0) | Don't Tell Mama | 81 |
| Birthday with Amma (4) | Windmills Craftworks, Whitefield | 0 | SkyDeck by Sherlock's | 58 |

Facts that don't depend on a Qloo score:
- Windmills Craftworks is price level 4; Amma's cap is 3. The baseline broke a stated limit.
- The baseline's reasons include details nothing backs up (a "live jazz vibe", "soft and melodic" music for Amma, a "Toit-style taproom after dinner"). Every Qloo-plan reason cites evidence ids checked on the server.
- The baseline said Matsuri is in Indiranagar; the only Matsuri Qloo has is on Lavelle Road.

**Caveat (say it wherever the numbers appear):** the yardstick is Qloo's own taste model, and the pool is Qloo's recommendations, so a pick from outside the pool tends to rank low. This measures distance from each friend's taste profile, not whether real people would enjoy the night more. A blind check with real people is the stronger test and is still to do.

**Gotcha found:** the first matcher took the Jayanagar branch of Meghana Foods although the model said Indiranagar. Matching now prefers the branch in the stated area (least-happy score for that pick went 0 → 0, mean 2 → 6).

## Failure → recovery
- 2026-10-22, spike 2: `/search` always returns a top result. "Sid Sriram's new song" resolved to "Sidney Bechet and His New Orleans Feetwarmers"; "filter coffee" as a place resolved to a café in Pisa. Fix planned: name-match guard → unresolved → one clarifying question; food terms go through `/v2/tags`.
- 2026-10-22, first agent run: the agent "helped" by searching "Toit Bengaluru"; Qloo returned "Toit" but the name guard needed every query word in the name, so Toit came back unresolved. It also pre-cleaned "Anirudh" → "Anirudh Ravichander" and "Sid Sriram's new song" → "Sid Sriram", hiding the ambiguity. Fix: a result may match the taste as typed or the query; the first lookup must use the taste as typed (enforced in code), rewrites only on retry, every attempt kept.
- 2026-10-22, second agent run (after the fix): "Anirudh" → ambiguous → agent chose Anirudh Ravichander and listed it as an assumption; "Sid Sriram's new song" → unresolved → retried as "Sid Sriram" → resolved, listed as an assumption. 12/12 tastes resolved. The pick (The 13th Floor) has no veg tag, so Asha's veg constraint was reported as unverified and the agent asked her one clarifying question instead of claiming it's veg-friendly.
- 2026-10-22, sample probes: the date-night pool's top fair pick was **Burger King**. Qloo tags chains clearly (`genre:place:restaurant:fast_food`, `…:pizza_takeout`), so `find_candidates` now drops fast food and takeaways and lists them in the X-ray. Qloo's `non_vegetarian_restaurant` tag now also counts, so KFC-style places are excluded for veg friends instead of "unverified".
- 2026-10-22, recordings: "Shankarabharanam" didn't match as typed; the agent retried with Qloo's spelling "Sankarabharanam" and said so. Veg claims in reasons traced to Qloo text ("a mix of vegetarian and non-vegetarian bar dishes"; specialty dish "Paneer Tikka").
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
| 2026-10-22 | Recorded samples on `claude-sonnet-5-5` | college friends 31.2 s, 22 Qloo calls, 42.0k/2.0k tokens · couple 11.3 s, 11 calls (all cached), 23.7k/0.7k · birthday 26.3 s, 22 calls (15 cached), 33.9k/1.4k | `npm run record` |
| 2026-10-22 | `/search` latency under 12 parallel lookups | 1.5–3.8 s each (vs 254 ms one at a time) | agent run trace |

## Lessons we paid for
- Invalid Qloo params are silently ignored: a typo looks like "no effect", not an error.
- `filter.tags=…restaurant` alone lets in cities, apartments and hotels in Bengaluru; `filter.price_level.min=1` + `filter.popularity.min=0.3` cleans it up.
- Qloo terms forbid storing their response data in a public repo → replays moved to private Redis, tests use hand-written fixtures.

# Spikes

Each spike records: works / doesn't, latency, rate-limit or quota use, gotchas. Date every entry.
Scripts: `scripts/spike-*.mjs` (raw responses go to gitignored `.qloo-raw/`; Qloo data must not be stored publicly).

## 1. Access and docs — 2026-10-22 ✅
- Guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
- Base URL: `https://hackathon.api.qloo.com` (hackathon keys don't work on other hosts)
- Auth header: `X-Api-Key: <key>`
- Rate limits (from response headers): **50,000 / month, 10 / second** (`x-month-ratelimit-*`, `x-second-ratelimit-*`)
- Endpoints used:
  - `GET /search?query=&types=urn:entity:<type>&take=` — free text → entities (`results[].entity_id`, `name`, `popularity`, `tags`, `properties.geocode`)
  - `GET /v2/tags?filter.query=&take=` — keyword → tag ids (`results.tags[].id`)
  - `GET /v2/insights?filter.type=...` — recommendations with `query.affinity` per entity
- Gotchas:
  - GET only, query-string params; **invalid params are silently ignored**.
  - Music is `urn:entity:artist`; there is no `music` type.
  - **Qloo terms: don't store response data in a public repo.** Server-side caching is allowed.
  - Git Bash rewrites a leading `/` in CLI args into a Windows path; pass paths without it.
  - Spike total: 49 calls.

## 2. Entity resolution — 2026-10-22 ✅ (with a guard)
21 inputs, `take=3`, median **254 ms**, max 728 ms (first call).

| Input | Top result | OK? |
|---|---|---|
| AR Rahman, Arijit Singh, Sid Sriram, Prateek Kuhad, Ilaiyaraaja, Diljit Dosanjh | exact artist | ✅ |
| Anirudh | "Anirudh" (pop 0.69); Anirudh Ravichander is #2 (pop 0.88) | ⚠️ ambiguous |
| Kantara, RRR, 3 Idiots, Kumbalangi Nights, ZNMD, Super Deluxe | exact film | ✅ |
| Panchayat, Scam 1992 | exact show | ✅ |
| Toit, MTR, Vidyarthi Bhavan (as `place`) | the Bengaluru venue | ✅ |
| filter coffee, biryani (as `place`) | random cafés (Pisa, Seoul…) | ❌ not entities |
| "Sid Sriram's new song" | "Sidney Bechet…" | ❌ junk match |

- Named entities: **17/18** correct as top-1. Dishes go through `/v2/tags` instead (spike 2b).
- **Search always returns something.** We need a name-match check (normalised top-1 name vs. input) and treat a miss as unresolved → agent asks one clarifying question or picks the closest and says so. "Sid Sriram's new song" is the failure → recovery demo case; "Anirudh" is the clarifying-question case.

### 2b. Tags for food and diet
`/v2/tags` resolves food terms cleanly (~240 ms):
- `filter coffee` → `urn:tag:specialty_dish:place:filter_coffee`
- `biryani` → `urn:tag:specialty_dish:place:biryani`, `urn:tag:cuisine:qloo:biryani`
- `vegetarian` → `urn:tag:dietary_option:qloo:vegetarian`, `urn:tag:genre:place:restaurant:vegetarian`
- `restaurant` → `urn:tag:category:place:restaurant` (and several near-duplicates; the `category` one works best)

Decision: input UX = free text per person; artists/films/shows/places via `/search`, food via `/v2/tags` as `signal.interests.tags`.

## 3. Recommendations from several people — 2026-10-22 ✅
Three fictional people (3 entities each: artist + film/show).
- **One call per person:** works, ~0.8–1.1 s, 8 places each, overlapping but different (Asha → Suchitra Cafe, Linto Coffee; Ravi/Meera → dhabas).
- **One call with all signals:** works, ~1 s, gives a merged pool.
- **Per-person score for a fixed pool: yes.** `filter.results.entities=<ids>` with one person's `signal.interests.entities` returns `query.affinity` for **every** candidate (10/10 for all three), ~420 ms per person.
- **Decision:** pool = one combined call (+ optionally each person's top few); then one scoring call per person over the pool. ≈ 1 + P insights calls per plan.
- ⚠️ **Affinities are compressed (0.87–0.94).** Raw-score maximin would decide on noise. Normalise per person within the pool (percentile rank) before maximin; show raw affinity in the X-ray.

## 4. Location coverage — 2026-10-22 ✅
Filters: `filter.tags=urn:tag:category:place:restaurant`, `filter.price_level.min=1`, `filter.location.query=<city>`.

| City | Results | Notes |
|---|---|---|
| Bengaluru | 8/8 | Without `price_level.min` + `popularity.min=0.3`, junk appears ("Bangalore", an apartment complex, hotels). With them: real restaurants/pubs |
| Mumbai, Delhi, Chennai, Hyderabad | 5/5 each | Real restaurants; Delhi includes an airport lounge |

- **Demo city: Bengaluru** (strong coverage, and Toit/MTR/Vidyarthi Bhavan resolve).
- Most results carry `price_level` (1–4) and a vegetarian tag; some don't → constraints may be "unverified".

## 5. Cross-domain — 2026-10-22 ✅
Music + film + TV signals alone produce Bengaluru restaurant rankings that differ per person, with explainability tying each place back to specific inputs. Raw responses kept privately in `.qloo-raw/` (not committed).

## 6. Explanations — 2026-10-22 ✅
- `feature.explainability=true` → `query.explainability["signal.interests.entities"] = [{entity_id, score}]` per result: which of the person's inputs drove the match (normalised 0–1). This is the evidence for per-person reasons.
- Place `properties` include `price_level`, `hours`, `address`, `geocode`, `keywords`, `specialty_dishes`, `cuisine_description`, `ambience_description`, `good_for`, `live_music`, `short_description`; plus `tags[]`.
- Reasons = "because of <their input X>" (explainability) + place facts (tags/properties). The model writes the sentence; it may only cite these.

## 7. Model choice
- Pinned: `claude-opus-5-5`, effort `medium`, adaptive thinking, `fallbacks: "default"`
- 2026-10-22, college-friends sample (4 people, 12 tastes): **29–38 s per plan**, 6 model turns, **~31k input / ~1.5k output tokens** (≈ $0.15 at $4/$20 per MTok). Tool time ≈ 9 s; the rest is the model.
- 18 Qloo calls per cold plan (12 lookups + 1 retry + 1 pool + 4 scoring); half came from cache on a rerun.
- Gotcha: 12 parallel `/search` calls take 1.5–3.8 s each (254 ms one at a time), so Qloo seems to queue concurrent requests.

## Budget
≈ 1 pool + P scoring + ~3P search/tag calls per plan, mostly cache hits after the first run. 3 people ≈ 13 calls cold. 50k/month leaves room for ~3,000 cold live plans; daily cap set well below.

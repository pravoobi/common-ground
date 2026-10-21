# Common Ground: architecture and implementation plan

Written Oct 22, 2026. Source of truth for requirements: `CLAUDE.md`. This file is the *how*.

> **Unverified until spike 1:** every Qloo endpoint, parameter and response field below. They are placeholders
> shaped by what Qloo's public docs looked like before; `SPIKES.md` wins as soon as it has real answers.

---

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | One repo for UI and server routes; `npm run build && npx tsc --noEmit` is the CLAUDE.md gate |
| Hosting | Vercel (hobby) | Public URL in minutes, works in incognito, free until Nov 16 |
| Agent | Anthropic TypeScript SDK (`@anthropic-ai/sdk`), Tool Runner (`client.beta.messages.toolRunner` + `betaZodTool`) | We define every tool, we host it; no extra agent framework to learn or justify |
| Model | `claude-opus-5-5`, pinned. `output_config.effort: "medium"` set explicitly. Adaptive thinking (default, can't be disabled). Server-side refusal fallback on (`fallbacks: "default"`) | Default current model; $4/$20 per MTok. Only live runs spend tokens; samples are replays |
| Model gotchas | No forced `tool_choice` (`any`/`tool` → 400): use `auto` + instructions + `strict: true` tools. Final plan via structured output, not prefill | From current API docs |
| Validation | `zod` | Already needed by `betaZodTool`; also validates Qloo responses |
| Cache + caps | Upstash Redis (free tier) in prod, in-memory/file in dev | Request-hash cache for Qloo, entity cache, session + daily caps across serverless instances |
| Replay store | Committed JSON in `data/runs/*.json` | Zero external calls on page load; reviewable in the repo |
| Styling | Tailwind | Fast mobile-first UI |
| Tests | Vitest + recorded Qloo fixtures | Scoring, constraints, parsing, client — all offline |
| Licence | MIT, `LICENSE` at root | Required; set in GitHub About |

Dependencies (each needs a one-line justification in its commit): `next react react-dom @anthropic-ai/sdk zod @upstash/redis @upstash/ratelimit tailwindcss vitest`.

---

## 2. Architecture

```
 Browser (mobile web)
   │  /                 landing + "try it in a minute"
   │  /g/[id]           plan as group-chat card  ── tabs: Plan · X-ray · Without Qloo
   │  /new              make your own group (live, capped)
   │  /present          story page
   ▼
 Next.js server
   ├─ GET  sample/run  → data/runs/<id>.json         (replay: no Qloo, no model)
   └─ POST /api/plan   → rate limit (session + daily) → Agent run, streamed as SSE steps
                             │
                ┌────────────┴─────────────┐
                ▼                          ▼
          Agent (Claude, Tool Runner)   Deterministic core (plain TS, tested)
          plans calls, writes reasons    ├─ constraints.ts  veg / budget / distance / time
                │  tools                  ├─ score.ts        maximin + mean tie-break
                ▼                          └─ explain.ts      tags → reason evidence
          lib/qloo/client.ts ── cache (request hash) ── Qloo API
                │
                └─ trace log → RunRecord (every Qloo call, scores, tokens) → X-ray + cost receipt
```

Key rule: **the model never produces a number.** Scores and rankings come from Qloo and `score.ts`; the model chooses which tools to call, handles unresolved inputs (one clarifying question max), and writes reason text that must cite tags returned by `explain`.

### Agent tools (provisional names; finalise after spike 1)

| Tool | Does | Backed by |
|---|---|---|
| `resolve_entities(texts[], type_hint)` | Free text → Qloo entities with confidence; returns unresolved list | Qloo search / entity lookup |
| `get_recommendations(signals[], filter_type, location, constraints)` | Candidate places/titles from group signals | Qloo insights |
| `score_for_person(person_id, candidate_ids[])` | Affinity of each candidate for one person | Qloo insights with that person's signals (spike 3 decides shape) |
| `rank_for_group(candidate_ids[])` | Applies constraints then maximin ranking; returns ranked list + per-person scores + who's lowest | `score.ts` (no API call) |
| `explain(candidate_id, person_id)` | Tags/attributes linking candidate to the person's tastes | Qloo entity tags / insights response |

The final answer is structured output (`Plan` schema below), validated with zod.

### Core types (`lib/types.ts`)

```ts
Person      { id, label, tastes: { text, domain }[], constraints: { veg?, maxPrice?, ... } }
Entity      { qlooId, name, type, matchedFrom: string, confidence }
Candidate   { qlooId, name, type, location?, priceLevel?, tags[] }
PersonScore { personId, candidateId, affinity: number | null }   // null = Qloo gave nothing; never filled in
Plan        { picks: { candidateId, when?, reasons: { personId, text, evidenceTags[] }[] }[], clarifyingQuestion? }
RunRecord   { id, group, plan, ranking, qlooCalls: TraceEntry[], tokens, cacheHits, timings, mode: "live" | "replay", recordedAt }
```

### Group scoring (`lib/score.ts`)

1. Drop candidates that break any person's hard constraint (veg, budget bucket, distance step, open at time).
2. For each remaining candidate: `min` over people of affinity, tie-break on `mean`.
3. A person with `affinity === null` for a candidate: candidate is flagged, not scored as zero or guessed. Ranked after fully-scored ones.
4. v0 (`mean` only) is kept behind a flag so the v0 → v1 evidence is reproducible on the same group.

### Without-Qloo baseline

Same model, same group text, no tools, same output schema. Generated once per sample by `scripts/baseline.ts`, stored in `data/runs/<id>.baseline.json`, labelled "Generated <date>, same model, no Qloo tools".

### Replay pipeline

`scripts/record.ts <groupfile>` runs the live agent once and writes the `RunRecord`. Samples are recorded from real runs and never edited by hand (except removing nothing; if a run is bad, re-record).

---

## 3. Repo layout

```
app/
  page.tsx                landing, try-it box, sample cards
  g/[id]/page.tsx         chat card + Plan / X-ray / Without Qloo tabs
  new/page.tsx            live group builder
  present/page.tsx        story page
  api/plan/route.ts       live run (SSE), capped
  opengraph-image.tsx
components/               ChatCard, StepRail, XRay, CompareView, CostReceipt, PersonInput
lib/
  qloo/client.ts          fetch wrapper: auth, retries, timing, trace, cache
  qloo/schemas.ts         zod schemas for Qloo responses (from spike output)
  agent/run.ts            Tool Runner setup, system prompt, structured output
  agent/tools.ts          betaZodTool definitions
  score.ts constraints.ts explain.ts cache.ts ratelimit.ts types.ts
data/
  groups/*.json           sample group inputs (fictional people, labelled)
  runs/*.json             recorded runs + baselines
scripts/                  record.ts, baseline.ts, spike-*.ts
tests/                    score, constraints, resolve parsing, qloo client (fixtures/)
docs/                     plan.md, progress.md, evidence.md
SPIKES.md  README.md  LICENSE  .env.example
```

---

## 4. Build plan

Days are relative to the start date. Before then, only zero-cost prep.

### Before start (any spare hour, Oct 22–26)
- [x] Plan, `SPIKES.md` template, progress/evidence files, git init, `.env.example`, `.gitignore`
- [x] Qloo API key requested Oct 22 (may take a few days)
- [x] Public GitHub repo + MIT licence (github.com/pravoobi/common-ground)
- [x] Vercel: https://common-ground-phi-bice.vercel.app/ (auto-deploys from main)
- [ ] Create Upstash account

### Day 1 morning — Spikes (done when `SPIKES.md` sections 1–7 are filled and demo city chosen)
- Clone `qloo-hackathon-kit` into a separate folder; read docs.qloo.com
- `scripts/spike-*.ts` hitting the real API; save raw responses as test fixtures
- Rewrite §2 tool table and `lib/types.ts` to match reality

### Day 1 afternoon – Day 2 — Core path (minimum submittable)
1. Scaffold Next.js, Tailwind, Vitest; deploy empty app to Vercel (live URL on day 1)
2. `qloo/client.ts` + cache + fixtures tests
3. `score.ts` + `constraints.ts` + tests (v0 mean and v1 maximin)
4. Agent with tools, restaurants in the demo city, structured `Plan` out
5. `/api/plan` with caps; minimal `/new` page showing the plan
6. Commit, deploy. **Checkpoint: if this isn't live by end of Day 2, cut Day 3.**

### Day 2 evening — Judge path
- Write 3 sample groups; record runs + baselines with scripts
- `/g/[id]` replay with chat card, X-ray tab, Without-Qloo tab; deep links from landing
- Step rail (replays recorded timings, no spinners)

### Day 3 — Depth (only if core is live)
- Second domain: film night at home (titles) for the couple sample
- Failure → recovery: unresolved input in a sample, recorded honestly
- Measured numbers: with vs. without on the 3 groups, latency, calls per plan, cache hit rate → `docs/evidence.md`

### Day 3 evening — Presentation
- WhatsApp share (`wa.me` link with the card text), `/present`, OG image
- README per CLAUDE.md §7, GIF from live site, feature map table

### Day 4 — Submit (Oct 30 evening IST latest)
- Devpost text per §12, links tested in incognito on a phone, review checklist, security check

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Key arrives late | Request today; spikes are the only blocker |
| Weak Bengaluru place coverage | Spike 4 picks the city; README says why |
| No per-person affinity for an arbitrary candidate | Spike 3; fallback = one insights call per person over the candidate pool, use returned rank/score only, `null` when absent |
| Rate limits | Cache everything, samples are replays, live caps |
| Agent slow (Opus + several tool rounds) | Effort `medium`, parallel tool calls, stream steps; if still slow, measure `low` |
| Time (short build window) | Day 2 checkpoint cuts depth |

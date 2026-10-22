# Progress

## 2026-10-22
- **Shipped:** `docs/plan.md` (architecture + build plan), `SPIKES.md` template, `docs/evidence.md`, git init, `.env.example`, `.gitignore`.
- **Blocked:** Qloo API key requested Oct 22, waiting. Start date not decided.
- **Next:** Vercel + Upstash accounts; on start day (key permitting) run spike 1. Repo: github.com/pravoobi/common-ground (public, MIT).
- **Also shipped:** Next.js scaffold with placeholder landing page; deployed to Vercel at https://common-ground-phi-bice.vercel.app/ (auto-deploys from `main`). Private notes moved to `CLAUDE.local.md` (gitignored).
- **Also shipped:** `lib/score.ts` (maximin + mean tie-break, v0 mean kept for evidence; missing scores never filled in, incomplete candidates rank last), `lib/constraints.ts` (veg / price / distance; unknown data kept but flagged unverified; distance quantised for cache keys), 15 Vitest tests passing. Timing/opening-hours constraint deferred until we know what Qloo returns.
- **Also shipped (later):** Qloo key received. Spikes 1–6 done and written up in `SPIKES.md`; demo city = Bengaluru. Plan updated: replays in private Redis (Qloo terms), food via tags, name-match guard, per-person percentile normalisation before maximin.
- **Next:** add percentile normalisation to `lib/score.ts`; build `lib/qloo/client.ts` (cache, rate-limit-safe) on these endpoints; then the agent.
- **Also shipped (later):** per-person percentile normalisation in `lib/score.ts` (default on; raw affinity kept for the X-ray). `lib/qloo/client.ts`: typed `search` / `searchTags` / `insights`, zod-validated, cached by request hash, 10 req/s throttle, retries on 429/5xx with retry-after, per-run trace without the key. `lib/qloo/resolve.ts`: name-match guard (unresolved / ambiguous / resolved). 47 unit tests + opt-in live smoke test (`npm run test:live`, ~6 calls) passing.
- **Next:** Upstash-backed cache (needs account) and the agent (needs `ANTHROPIC_API_KEY` in `.env.local`).

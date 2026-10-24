# CLAUDE.md — Common Ground (Qloo Agentic Hackathon)

Project instructions for Claude Code. Read fully before any task. Architecture and build plan: `docs/plan.md`.

---

## 0. Fill these in first (day 1)

- **Hackathon:** Qloo Agentic Hackathon ("Agents, but with taste.") — Devpost, sponsor Qloo.
- **Sponsor tech that must do real work:** Qloo API and taste graph (cross-domain taste across music, film/TV, dining, fashion, travel, and more).
- **Track:** single track. Entry type: an agent-powered app (a tool-calling agent that uses Qloo as its taste tools).
- **Build window:** registration and submission Sep 30 → **Oct 30, 2026, 11:45pm ET (Oct 31, 9:15am IST)**. Submit by **Oct 30 evening IST**; the morning of Oct 31 IST is buffer only.
- **Submission requirements (official rules):**
  - Working software that integrates the Qloo API and is an agentic tool, is built with an agent framework, or adds Qloo to an existing agent.
  - A **functional demo link**, hosted and fully published externally (live site or web app, hosted APK or TestFlight). Local-only or private-access demos don't qualify.
  - A **public repo** (GitHub, GitLab or Bitbucket) with all source, assets and run instructions.
  - An **open-source licence file**, visible in the repo's About section.
  - A **text description** of features and what makes it "Qloo-powered".
  - **No video required.** Judges want something they can use. Judges may also judge from the text alone, so the description must stand on its own.
  - Free, unrestricted testing access for sponsor and judges until judging ends (Nov 5; the rules list judging as Nov 2–5). If anything needs a login, put credentials in the testing instructions.
  - New project, or an existing one significantly updated during the submission period with the updates explained. This entry is a new project.
- **Judging criteria (from the official rules), and where each is proven.** Stage one is pass/fail: fits the theme and genuinely uses the Qloo API. Stage two scores four criteria equally; ties go by criterion order, then a judge vote.

  | Criterion | Weight | Proven by |
  |---|---|---|
  | Technological Implementation: how thoroughly and skilfully the project uses Qloo; genuine, non-trivial working code | 25% | Agent with several Qloo tools; X-ray panel showing each Qloo call; feature map table in README |
  | Design: a complete, coherent product experience, not a technical proof of concept | 25% | One flow from "who's coming" to a shareable plan; outputs in context (group chat card); onboarding copy |
  | Potential Impact: a credible, specific case for a real problem for a real audience, demonstrated | 25% | The group-chat deadlock problem; side-by-side "with vs. without Qloo" result; one measured number |
  | Quality of the Idea: a creative, non-obvious use of Qloo, with real understanding of the problem space | 25% | Finding the overlap between several people's tastes, across domains, instead of recommending to one person |

  The judges' own test, from the hackathon page: if the submission would work the same without Qloo, it's the wrong thing. The "without Qloo" comparison (§3) answers that directly.
- **Side prizes to target:** none separate. Prizes are 1st $15,000, 2nd $6,000, 3rd $4,000; one prize per project. Judges include investors, so the README carries a short business model (§7).
- **Required items checklist:**
  - [ ] Qloo API key from the Google Form linked on the hackathon page
  - [ ] Live demo URL, works in incognito with no setup
  - [ ] Public repo with an OSI licence visible in About
  - [ ] Text description that stands alone (judges may not open the app)
  - [ ] Testing instructions (and credentials if any login exists; prefer none)
  - [ ] Demo stays up and within API limits until Nov 5 (leave it up to Nov 16 for margin)

### The one sentence

> A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan where those tastes overlap.

Every feature, README section and demo beat should support this sentence. If a feature doesn't, it's out of scope.

### Why a group

A single-user taste concierge is close to what an LLM already does. Common Ground works on the **group**: several people, each with different tastes across domains, and one plan (a dinner spot plus an activity or a film night) that scores well for everyone, with a per-person reason. That needs real affinity scores, which an LLM alone can't produce.

---

## 1. How judges experience this project

1. They open the README. First screen: a looping GIF of four friends' tastes turning into one plan, the live demo link, and a "Try it in a minute" box:
   1. Open sample group "College friends, Bengaluru, Saturday night" — replay
   2. Open sample group "Couple with opposite tastes, film night at home" — replay
   3. Open the "Without Qloo" comparison for the first group
   4. Open the X-ray view of one plan
   5. Make your own group (live, capped)
2. They click a sample. It works with **no signup, no keys, no cost, no failure**: a replay of a real recorded run served from stored results.
3. They look for Qloo. The X-ray panel names every Qloo call and shows the affinity scores behind each pick.
4. They read the description or watch the optional short video.

Build the judge path in the first half of the build, not the last day.

---

## 2. Process rules

### Spikes first, written down (results go in `SPIKES.md`)

Each spike records: works / doesn't, latency, rate-limit or quota use, gotchas.

1. **Access and docs.** Get the key via the form. Clone and read the official `qloo-hackathon-kit` repo linked from the hackathon page. Read the developer guide at docs.qloo.com in a browser. Record the hackathon base URL, auth header, rate limits and the endpoints below. Nothing in this file about request shapes has been verified yet; the docs win.
2. **Entity resolution.** Can free text like "AR Rahman", "Kantara", "Toit" or "filter coffee" be resolved to Qloo entities reliably? Record hit rate on 20 typical inputs from an Indian user. This decides the input UX.
3. **Recommendations from several people's signals.** Can one insights request take signal entities from several people and return places or titles with affinity scores? Or do we need one request per person and combine scores ourselves? Record both ways.
4. **Location coverage.** How good are place results for Bengaluru (and one or two other Indian cities)? If coverage is thin, pick the demo city where results are strong and say so in the README; don't pretend.
5. **Cross-domain.** Does "loves these artists and films" produce sensible restaurant or neighbourhood results (the cross-domain claim)? Save real examples; they become the demo.
6. **Explanations.** What does the API return that explains a match (tags, attributes, popularity)? The per-person reasons must come from this, not from the model's imagination.
7. **Model choice.** Pin the agent's model id. No "auto" selection.

### Core path before polish

Core path = enter 2–4 people's tastes → resolve to entities → Qloo recommendations for one domain (restaurants in one city) → group score → one recommended plan with per-person reasons, live and committed. That is the minimum submittable product. A second domain (film night or activity), the comparison view and polish come after.

### Capture evidence while building (`docs/evidence.md`)

- **v0 → v1:** v0 averaged scores and picked places one person hated; v1 uses a fairness rule (e.g. maximise the lowest person's score) and the plan changed. Show both, same group.
- **Failure → recovery:** shown on purpose in the demo. Example: an input doesn't resolve ("Sid Sriram's new song"), the agent asks one clarifying question or picks the closest entity and says so; or a pick scores low for one person and the agent swaps it and explains why.
- **Measured numbers, dated:** with vs. without Qloo on the same groups (e.g. how many of the plan's picks each person rates as a match, using a small blind check with real friends if possible); latency per plan; Qloo calls per plan; cache hit rate.
- **Lessons we paid for:** entity resolution quirks, coverage gaps, rate limits.

### Commits

- Small, frequent commits with clear messages.
- `npm run build && npx tsc --noEmit` must pass before pushing to `main`.
- No new dependency without a one-line justification in the commit message.

---

## 3. Make the sponsor tech visible

- **"Without Qloo" comparison:** the same group answered by the same model with no Qloo tools, side by side with the Qloo-grounded plan. This is the judges' own test, shown on screen. Generate the baseline once and store it; label it honestly.
- **X-ray panel:** for each pick, the Qloo calls made (endpoint, entities, filters; no keys), the affinity score per person, and the tags or attributes that justify the reason text.
- **Step rail:** Resolving tastes → Finding overlap → Building the plan, each step lighting up when the real calls return.
- **Cost receipt:** Qloo calls and model tokens per plan, and what the cache saved.

README:
- **Feature map table:** `# | Qloo capability | Exactly what we send | Code link`. Every row does real work; mark anything set up but unused.
- **Architecture diagram** near the top.

### Agent design

- A tool-calling agent on the server. Tools wrap Qloo; names and shapes are finalised after spike 1:
  - `resolve_entities(texts, type_hint)` — free text to Qloo entities
  - `get_recommendations(signals, filter_type, location)` — insights for places or titles with affinity scores
  - `score_for_person(person, candidates)` — affinity of each candidate for one person
  - `explain(candidate, person)` — tags and attributes that support a reason
- **Group scoring is deterministic code**, not the model: fairness rule (maximise the minimum, with a tie-break on the mean), hard constraints (veg, budget, distance, timing) applied before scoring. The model plans tool calls and writes reasons grounded in `explain` output.
- The agent asks at most one clarifying question per plan.

---

## 4. Demo and presentation surfaces

- **Seeded samples:** 3 groups with realistic, varied tastes (different languages of music and film, different food habits), fully pre-processed. Sample people are fictional and labelled as such.
- **Replay mode:** samples replay stored results; zero Qloo or model calls on page load.
- **Outputs in context:** the plan shown as a group-chat card (WhatsApp-style message with the place, time, and one line per friend), with "Share to WhatsApp". Not a list of results.
- **Localisation:** Indian cities, ₹ price levels, Indian music and film in the samples, veg/non-veg as a constraint.
- **Story page:** `/present` (built), chapter by chapter: the group-chat deadlock, four tastes, the overlap, without vs. with Qloo, the number.
- **Share preview:** OG image for the live URL and repo.
- **Test suite visible:** tests for group scoring, constraints, entity-resolution parsing and the Qloo client (recorded fixtures). Test count in the README, passing run screenshot in the gallery.
- **README GIF:** recorded from the live site, looping, first thing on the page.
- **Optional video (60–90s):** not required, but useful for judges who won't click. Same beats as §11.

---

## 5. Cost and reliability rules

- Generate once, store the result, serve the stored result. Never call Qloo or the model on render.
- Cache every Qloo response keyed by request hash; cache resolved entities by normalised text.
- Quantise inputs (distance in steps, price level buckets) so nearby requests reuse cache.
- Gate the live "make your own group" flow with a session cap and a global daily cap; samples stay open.
- Every external call: logged, errors caught, readable failure shown. One unresolved entity must not break the plan.
- Record API limits from spike 1 in `SPIKES.md` and keep the live demo under them through Nov 5, and ideally Nov 16.

---

## 6. Security

- Zero credentials in the repo. `.env.local` never committed; `.env.example` always current (`QLOO_API_KEY`, `QLOO_BASE_URL`, model key, caps).
- Qloo and model keys stay server-side; only public values reach the browser.
- Rate-limit every route that spends API calls or tokens.
- Before finishing any task: `git diff --cached | grep -iE "secret|api_key|token"` returns nothing outside `.env.example`.
- No personal data stored beyond the session; group inputs are not logged with names.

---

## 7. README structure

1. Common Ground + the one sentence + looping GIF
2. Links: live demo · sample group · without-Qloo comparison · story page · how it's built
3. "Try it in a minute" box (§1)
4. The problem: a concrete group-chat scene, 40 messages and no plan
5. What it does: step table (step / what happens / which Qloo capability)
6. How it's built: architecture diagram, feature map table, agent tools
7. The one interesting technical idea: finding a fair overlap of several people's affinities across domains, explained with one real example from the X-ray
8. Evidence: v0 → v1 (averaging vs. fairness), failure → recovery, without vs. with Qloo numbers
9. Cost engineering: calls and tokens per plan, cache savings
10. How judges can test · Run locally · Security and privacy · Limitations (coverage gaps found in spikes) and roadmap
11. Business model and why now (for the investor judge): who pays (restaurants, event venues, group-booking apps), one paragraph, no inflated market numbers
12. How it was built with Claude Code

---

## 8. Timeline

A compressed build. Days are relative to the start date.

| Phase | Day | Done when |
|---|---|---|
| Spikes + setup | Day 1 morning | Key, kit read, spikes 1–6 in `SPIKES.md`, demo city chosen |
| Core path | Day 1 afternoon – Day 2 | Restaurants for 2–4 people with fair group scoring and grounded reasons, live and committed (minimum submittable) |
| Judge path | Day 2 evening | 3 seeded groups, replay, deep links, X-ray, without-Qloo comparison |
| Depth | Day 3 | Second domain (film night or activity), failure → recovery, measured numbers |
| Presentation | Day 3 evening | Chat card in context, `/present`, OG image, README GIF, README |
| Submit | Day 4 (Oct 30 evening IST at the latest) | Description, testing instructions, links tested in incognito; submitted |
| Buffer | Oct 31 until 9:15am IST | Nothing planned |

If the core path isn't committed by the end of Day 2, cut Depth entirely and ship one domain with the judge path.

Update `docs/progress.md` at the end of each session: shipped, blocked, next.

---

## 9. When working on a task

1. Read `docs/progress.md`, `SPIKES.md` and `docs/evidence.md` first.
2. Say which timeline phase the task belongs to. If it's ahead of the current phase, ask before starting.
3. Don't start depth or polish work until the core path is committed.
4. When something fails in an interesting way, add it to `docs/evidence.md` before fixing it.
5. When you measure something, record the number and the date.
6. Run the security check (§6) before finishing.
7. Never invent affinity scores, entities or reasons. If Qloo returns nothing useful, the UI says so.
8. Before submission, go through the criteria table in §0 (and the review checklist in `CLAUDE.local.md`, if present) and fix every miss.

---

## 10. Product principles

- The friend who always ends up organising is the user. Replace the group-chat back-and-forth end to end, not "chat with a recommender".
- The output is a WhatsApp-ready message; mobile-first.
- Every score shown is a real Qloo score. Say clearly what's a replay.
- Show the agent catching its own mistakes: the fairness swap or the unresolved-entity recovery.
- Document Qloo limits found and the workaround.
- One working flow end to end beats several half-features. Say plainly what isn't built yet.

---

## 11. Demo beats (for the optional video and the `/present` page)

| Time | Beat |
|---|---|
| 0:00–0:15 | Group chat: "where should we go Saturday?" 40 messages, no plan. |
| 0:15–0:20 | The one sentence. |
| 0:20–0:55 | Four friends' tastes in, one plan out, with a reason for each friend. |
| 0:55–1:15 | Without Qloo vs. with Qloo, side by side; the X-ray with real affinity scores. |
| 1:15–1:30 | The number and the live link. |

Rules: voiceover plus captions; no copyrighted music; replay slow calls so no spinners; record from `/present` and the live app on a phone.

---

## 12. Devpost submission structure

Keep the platform's template headings.

- **Title + tagline:** Common Ground + the one sentence.
- **Thumbnail:** the group-chat card with four faces and one plan, readable small.
- **Video** (optional) at the top if made.
- **Inspiration:** one real group-planning moment, if there is one.
- **What it does:** table of group situation → what Common Ground does.
- **How we built it:** architecture diagram, agent tools table, each Qloo capability and why.
- **Challenges:** entity resolution, combining several people's affinities fairly, coverage.
- **Accomplishments:** without vs. with Qloo numbers.
- **What we learned / What's next:** includes Qloo limits hit.
- **Built with:** Qloo API (exact endpoint names from the docs), the agent framework, the stack.
- **Try it out:** live demo first, then the repo.
- **Gallery:** chat card, without-vs-with comparison, X-ray, architecture, passing tests.

Keep counts consistent everywhere.

---

## 13. After submitting

- Share the project (LinkedIn, X, the hackathon Discord), tagging Qloo.
- Keep the live demo up and within API limits until Nov 5 (leave it up to Nov 16 for margin). Check it daily.

---

## Out of scope

- User accounts, saved groups, friend invites by link
- Bookings or payments
- More than two domains
- Native mobile apps (mobile web only)
- Scraping reviews or any non-Qloo taste data

## Open questions

- Which demo city, after the coverage spike?

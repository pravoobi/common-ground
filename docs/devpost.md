# Devpost submission text

Paste-ready text for the Devpost form, in the platform's headings. Numbers match the README; if one changes, change both.

---

## Title

Common Ground

## Tagline

A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan where those tastes overlap.

## Thumbnail

The share preview image: `https://common-ground-phi-bice.vercel.app/opengraph-image`

---

## Inspiration

<!-- Replace with your own group-planning moment if you have one; a real one beats this. -->

Saturday, 4:10 pm, a WhatsApp group of four. "Where are we going tonight?" Forty messages later: one friend is vegetarian, one is on a budget, one wants a brewery, one says "anything is fine" and then vetoes everything. Someone always ends up organising, and they're guessing what everyone else likes.

Every recommender we've used is built for one person. Ask a chatbot for "a place four friends will like" and you get a confident guess with reasons nobody can check. We wanted the opposite: real taste data for each friend, a pick that's fair to the friend least like the others, and one line per friend on why it works for them, ready to paste into the chat.

## What it does

You tell Common Ground who's coming (2–4 friends), a few things each one loves (artists, films, shows, places, dishes) and any limits (veg, budget). An agent turns that into one restaurant and a WhatsApp-ready message with a reason for each friend.

| Group situation | What Common Ground does |
|---|---|
| Four friends with tastes from Anirudh to Arctic Monkeys | Matches every taste to a Qloo entity or tag, and finds restaurants that people with those tastes love |
| One friend's taste is nothing like the others' | Adds each friend's own top places to the candidates, then picks the place whose **least-happy friend is happiest**, not the highest average |
| Someone is vegetarian or on a budget | Applies hard limits before scoring; if Qloo can't confirm a place is veg-friendly, it says "unverified" and asks one question instead of guessing |
| "Anirudh" could be two artists; "Sid Sriram's new song" isn't an entity | Picks the closest match and says so, or retries and lists the assumption. One bad taste never breaks the plan |
| The organiser needs to convince the group | One sentence per friend, each citing evidence Qloo returned (which of their tastes drove the match, the place's tags and dishes), plus a Share to WhatsApp button |
| A judge asks "would this work without Qloo?" | Every sample shows the same model with no Qloo tools, side by side, scored the same way |

Three sample groups replay real recorded runs instantly (no sign-up, no cost). The **X-ray** under each plan shows every Qloo call with its parameters, each friend's score for each place, and the evidence behind each reason. **Make your own group** runs the agent live in about 20–30 seconds.

## How we built it

```
Browser ──POST group (capped)──▶ /api/plan (streams steps)
   │                                  │
   └─GET sample──▶ Redis (recorded runs)   Claude agent (Tool Runner)
                                      │
            resolve_tastes · choose_option · find_candidates · rank_for_group · explain_pick
                                      │
               Qloo client (cache, 10 req/s throttle, retries, trace) ──▶ Qloo /search, /v2/tags, /v2/insights
                                      │
               Deterministic scoring: percentile per friend, hard limits, maximin
```

**The model never produces a number.** Claude (`claude-sonnet-5-5`) decides which tools to call, classifies each taste, handles ambiguous and unmatched tastes, and writes one sentence per friend. Matching, scoring, constraints and the pick itself are plain TypeScript with tests. Before a plan is shown, the server keeps only evidence ids that Qloo actually returned for that friend; a reason with none left is labelled "unverified".

**The agent's tools**

| Tool | What it does |
|---|---|
| `resolve_tastes` | Free text → Qloo entities (artists, films, shows, books, places) or tags (dishes, drinks). The first lookup must use the words as typed; retries are kept as a visible trail |
| `choose_option` | Resolves an ambiguous taste to one of the options Qloo returned, and only those |
| `find_candidates` | One Insights call for the whole group plus one per friend; each friend's top 3 join the pool; fast-food chains dropped by tag |
| `rank_for_group` | Scores every candidate for each friend, applies veg and budget limits, ranks fairly, and reports what averaging would have picked |
| `explain_pick` | Numbered evidence per friend: which of their tastes drove the match, plus the place's tags, dishes and price |

**Each Qloo capability and why**

| Qloo capability | What we send | Why |
|---|---|---|
| Entity search `/search` | The taste as typed, typed to artist, movie, TV show, book or place, plus a name-match guard | Search always returns *something*; the guard turns a junk match into an honest "unresolved" |
| Tag search `/v2/tags` | Dishes and drinks ("filter coffee", "craft beer") | Food tastes are tags in Qloo, not entities |
| Insights `/v2/insights`, group pool | Everyone's entities and tags, `filter.location.query`, restaurant tag, price range, `popularity.min` | Places people with these combined tastes love, in the right city and budget |
| Insights, per friend pool | One friend's signals, `take=10` | Without this the pool follows the majority and the odd one out never gets a say |
| Insights with `filter.results.entities` + `feature.explainability` | One friend's signals against the fixed pool | A real affinity for every friend × place, and which of their tastes drove it |
| Place tags and properties | Veg / non-veg tags, fast-food tags, specialty dishes, price level | Hard limits and grounded reasons |

Every Qloo response is validated with zod, cached in Upstash Redis by request hash for 7 days, and logged in a per-run trace that the X-ray shows (never the key). Live runs are capped per visitor and per day.

## Challenges we ran into

- **Entity resolution.** Qloo search always returns a result, even for nonsense, so we added a name-match guard. The agent also "helpfully" rewrote "Toit" as "Toit Bengaluru" and missed it; now the first lookup must use the words as typed, and the server enforces it.
- **Combining several people's affinities fairly.** One person's affinities across a pool sit close together (0.87–0.94), so raw scores can't be compared across friends. We turn each friend's scores into a percentile within the pool, then maximise the minimum with a tie-break on the average.
- **The majority wins by default.** With the candidates from one combined Insights call, averaging and fairness agreed on every sample: places only the odd one out loves were never considered. Adding each friend's own top places fixed it.
- **Coverage and data gaps.** Many restaurants have no veg tag, so a veg limit is often "unverified" rather than confirmed. Burger King came up as a date-night pick until we dropped fast food by tag.
- **Speed.** Parallel searches slow down on the hackathon key; we throttle to 10 req/s, cache everything, and switched from Opus 5.5 to Sonnet 5.5 (29–38 s → 11–31 s per plan, reasons still grounded).

## Accomplishments that we're proud of

**Without Qloo vs with Qloo**, same model, same group, same instructions, no tools. Each pick is scored for each friend with Qloo over the same pool (the candidates plus the no-Qloo pick); the figure is the least-happy friend's percentile (100 = their best match there).

| Sample | Without Qloo | Least happy | With Qloo | Least happy |
|---|---|---|---|---|
| College friends (4) | Meghana Foods | 0 | The 13th Floor | 71 |
| Couple (2) | Matsuri | 0 (Nisha 100, Arjun 0) | Don't Tell Mama | 81 |
| Birthday with Amma (4) | Windmills Craftworks | 0 | SkyDeck by Sherlock's | 58 |

The caveat, stated plainly: the yardstick is Qloo's own taste model and the pool is Qloo's recommendations, so a pick from outside it tends to rank low. It measures distance from each friend's taste profile, not whether real people would enjoy the night more. What needs no Qloo score: the no-Qloo plan for Amma's birthday is priced above her stated budget; its reasons include details nothing backs up ("live jazz vibe"); and it put Matsuri in Indiranagar, while the only Matsuri Qloo knows is on Lavelle Road.

**Fairness changes the pick.** In the birthday sample, averaging picks The 13th Floor and leaves Tanvi at her 52nd percentile; fairness picks SkyDeck by Sherlock's and lifts her to 57, at the cost of Sameer's favourite. The gap is modest, and we report it as measured.

Also: 77 tests on hand-written fixtures, every reason checked against evidence ids, and a plan in 11–31 seconds for about $0.05–0.10 with 11–22 Qloo calls.

## What we learned

- Qloo is strongest when you ask it about a **fixed set** of places for one person (`filter.results.entities` + explainability): that turned "recommendations" into a score table we can be fair with.
- Search needs a guard, food is tags not entities, and veg data is patchy. We show "unverified" rather than guess.
- Limits we hit: 10 requests a second and 50,000 a month on the hackathon key; parallel searches slow to 1.5–3.8 s each.
- Letting the model write sentences but never numbers made the output both readable and checkable.

## What's next for Common Ground

- A blind check with real friend groups, the stronger test than Qloo's own yardstick.
- A second domain: a film night at home.
- "Who's coming" from a pasted group chat.
- Distance and opening hours (constraint code exists; it needs friends' locations), and booking links.
- Testing beyond Bengaluru end to end (Mumbai, Delhi, Chennai and Hyderabad returned real restaurants in spikes).

## Built with

Qloo API (`/search`, `/v2/tags`, `/v2/insights` with `filter.results.entities` and `feature.explainability`) · Anthropic Claude (`claude-sonnet-5-5`) via the Anthropic TypeScript SDK Tool Runner · Next.js · React · TypeScript · Tailwind CSS · zod · Upstash Redis · Vercel · Vitest · Claude Code

## Try it out

- Live demo: https://common-ground-phi-bice.vercel.app/
- Sample group: https://common-ground-phi-bice.vercel.app/g/birthday-with-amma
- The story in five chapters: https://common-ground-phi-bice.vercel.app/present
- Repo: https://github.com/pravoobi/common-ground

## Testing instructions

No login, no keys. Open the live demo in any browser (incognito works). `/present` is the five-chapter story, from the group chat to the numbers. The three sample groups replay real recorded runs; scroll under a plan for the X-ray and the Without Qloo vs with Qloo comparison. `/new` runs the agent live (about 20–30 s, 3 runs per visitor per day). The demo stays up until judging ends.

## Gallery (to upload)

1. The group-chat card for a sample plan
2. Without Qloo vs with Qloo
3. The X-ray: Qloo calls and per-friend scores
4. Architecture diagram
5. Passing test run

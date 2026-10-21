# Spikes

Each spike records: works / doesn't, latency, rate-limit or quota use, gotchas. Date every entry.

## 1. Access and docs
- Status:
- Base URL:
- Auth header:
- Rate limits / quota:
- Endpoints used (exact names and params):
- Gotchas:

## 2. Entity resolution (20 typical Indian inputs)
| Input | Resolved to | Correct? |
|---|---|---|
- Hit rate:
- Latency:
- Decision for input UX:

## 3. Recommendations from several people's signals
- One request with all signals:
- One request per person, combined by us:
- Does a per-person affinity for a given candidate exist? How:
- Decision:

## 4. Location coverage
| City | Query | # results | Quality notes |
|---|---|---|---|
- Demo city chosen:

## 5. Cross-domain
- Example (tastes → places), saved to `tests/fixtures/`:
- Verdict:

## 6. Explanations
- Fields returned that justify a match (tags, attributes, popularity):
- Usable for per-person reasons?:

## 7. Model choice
- Pinned: `claude-opus-5-5`, effort `medium`, adaptive thinking, `fallbacks: "default"`
- Measured latency per plan:
- Tokens per plan:

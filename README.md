# Common Ground

> A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan where those tastes overlap.

**Live demo:** https://common-ground-phi-bice.vercel.app/

Built for the Qloo Agentic Hackathon. **Work in progress**: sample groups, the live planner and the full write-up are coming.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # fill in keys once the Qloo integration lands
npm run dev                  # http://localhost:3000
```

Checks before pushing:

```bash
npm test && npm run build && npm run typecheck
npm run test:live   # optional: real Qloo calls (~6), needs .env.local
```

## Docs

- [Architecture and build plan](docs/plan.md)
- [Spike results](SPIKES.md)

## Licence

[MIT](LICENSE)

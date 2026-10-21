# Common Ground

> A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan where those tastes overlap.

Built for the Qloo Agentic Hackathon. **Work in progress**: the live demo, sample groups and full write-up are coming.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # fill in keys once the Qloo integration lands
npm run dev                  # http://localhost:3000
```

Checks before pushing:

```bash
npm run build && npm run typecheck
```

## Docs

- [Architecture and build plan](docs/plan.md)
- [Spike results](SPIKES.md)

## Licence

[MIT](LICENSE)

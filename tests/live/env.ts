import { readFileSync } from "node:fs";

// Live tests run only via `npm run test:live`, so plain `npm test` never spends calls.
export const live = process.env.npm_lifecycle_event === "test:live";

/** Values from .env.local, read only when running live. Never printed. */
export const env: Record<string, string> = live
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), unquote(l.slice(l.indexOf("=") + 1).trim())]),
    )
  : {};

function unquote(v: string): string {
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

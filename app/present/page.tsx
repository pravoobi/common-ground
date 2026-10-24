import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { ComparisonView } from "@/components/ComparisonView";
import { GroupSummary } from "@/components/GroupSummary";
import type { Comparison } from "@/lib/agent/compare";
import type { PlaceView, RunRecord } from "@/lib/agent/record";
import { shortName } from "@/lib/plan-text";
import { loadComparison, loadReplay } from "@/lib/replays";
import { getSample, SAMPLES } from "@/lib/samples";

export const metadata: Metadata = {
  title: "The story · Common Ground",
  description: "From a 40-message group chat to one place everyone likes, in five short chapters.",
};

const STORY_ID = "birthday-with-amma";
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : String(Math.round(x * 100)));

async function getReplay(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`replay-${id}`);
  return loadReplay(id);
}

async function getComparison(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`comparison-${id}`);
  return loadComparison(id);
}

function Chapter({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-4">
      <p className="text-xs uppercase tracking-wide opacity-60">Chapter {n}</p>
      <h2 id={`${id}-h`} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** An invented chat, labelled as such: the scene the problem section describes. It is not Qloo data. */
const CHAT = [
  ["Kabir", "where are we going tonight?"],
  ["Tanvi", "anything is fine"],
  ["Sameer", "wings?? that place with the craft beers"],
  ["Tanvi", "not there. too loud"],
  ["Kabir", "ok somewhere else then"],
  ["Tanvi", "anything is fine!!"],
  ["Sameer", "…"],
  ["Kabir", "someone just pick"],
];

function Deadlock() {
  return (
    <>
      <p>
        Saturday, 4:10 pm. Forty messages later nobody has a plan, and the person who always organises is guessing what
        everyone likes.
      </p>
      <ul aria-label="An illustrative group chat" className="flex flex-col gap-2 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
        {CHAT.map(([who, text], i) => (
          <li key={i}>
            <span className="font-medium">{who}:</span> {text}
          </li>
        ))}
        <li className="text-xs opacity-60">…32 more messages. An invented scene, not data.</li>
      </ul>
    </>
  );
}

function Overlap({ record }: { record: RunRecord }) {
  const people = record.group.people;
  const name = (id: string) => shortName(people.find((p) => p.id === id)?.label ?? id);
  const fair = record.plan.pick;
  const avg = record.plan.averagingPick;
  const full = (p: PlaceView | null) => (p ? (record.ranking.find((r) => r.id === p.id) ?? p) : null);
  const rows = [
    { label: "Averaging picks", place: full(avg) },
    { label: "Fairness picks", place: full(fair) },
  ].filter((r): r is { label: string; place: PlaceView } => r.place !== null);
  const min = (p: PlaceView) => Math.min(...people.map((x) => p.scores[x.id]?.percentile ?? 1));
  const mean = (p: PlaceView) => people.reduce((a, x) => a + (p.scores[x.id]?.percentile ?? 0), 0) / people.length;

  return (
    <>
      <p>
        Each friend&apos;s tastes score every candidate place. Because one person&apos;s raw scores sit close together, they
        become percentiles (100 = that friend&apos;s favourite in the pool). The pick is the place whose least-happy friend is
        happiest.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="opacity-60">
              <th className="py-1 pr-3 font-normal" />
              {people.map((p) => (
                <th key={p.id} className="py-1 pr-3 font-normal">
                  {name(p.id)}
                </th>
              ))}
              <th className="py-1 pr-3 font-normal">Least happy</th>
              <th className="py-1 pr-3 font-normal">Average</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, place }) => (
              <tr key={label} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">
                  {label} <strong>{place.name}</strong>
                </td>
                {people.map((p) => (
                  <td key={p.id} className="py-1 pr-3 tabular-nums">
                    {pct(place.scores[p.id]?.percentile)}
                  </td>
                ))}
                <td className="py-1 pr-3 font-medium tabular-nums">{pct(min(place))}</td>
                <td className="py-1 pr-3 tabular-nums">{pct(mean(place))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!avg && <p className="text-sm opacity-70">On this group the two rules agree.</p>}
      <p className="text-sm opacity-80">
        Averaging chases the happiest friend; fairness lifts the one at the bottom. The gap is modest, and we report it as
        measured. The model never produces a number; all of these are Qloo scores run through plain code.
      </p>
    </>
  );
}

function TheNumber({ items }: { items: { id: string; title: string; comparison: Comparison; record: RunRecord }[] }) {
  return (
    <>
      <p>
        The same model, the same group, with and without Qloo. Each pick is scored for each friend with Qloo; the figure is
        the least-happy friend&apos;s percentile (100 = their best match in the pool).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="opacity-60">
              <th className="py-1 pr-3 font-normal">Group</th>
              <th className="py-1 pr-3 font-normal">Without Qloo</th>
              <th className="py-1 pr-3 font-normal">With Qloo</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ id, title, comparison, record }) => (
              <tr key={id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">
                  <Link href={`/g/${id}#compare-heading`} className="underline">
                    {title}
                  </Link>
                </td>
                <td className="py-1 pr-3 tabular-nums">
                  {comparison.baseline.output.place_name}: {comparison.scores.baseline ? pct(comparison.scores.baseline.min) : "not in Qloo"}
                </td>
                <td className="py-1 pr-3 tabular-nums">
                  {record.plan.pick?.name}: {pct(comparison.scores.qloo.min)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-xl border border-amber-500/50 p-3 text-sm">
        Read this with the caveat: the yardstick is Qloo&apos;s own taste model and the pool is Qloo&apos;s recommendations, so
        a pick from outside it tends to rank low. It measures distance from each friend&apos;s taste profile, not whether real
        people would enjoy the night more. A blind check with real groups hasn&apos;t been done yet.
      </p>
    </>
  );
}

async function Story() {
  const [record, comparison, ...others] = await Promise.all([
    getReplay(STORY_ID),
    getComparison(STORY_ID),
    ...SAMPLES.flatMap((s) => [getReplay(s.id), getComparison(s.id)]),
  ]);
  if (!record || !comparison) {
    return <p className="text-sm opacity-70">The story needs the recorded sample, which isn&apos;t available right now.</p>;
  }

  const items = SAMPLES.flatMap((s, i) => {
    const r = others[i * 2] as RunRecord | null;
    const c = others[i * 2 + 1] as Comparison | null;
    return r && c ? [{ id: s.id, title: s.group.title, record: r, comparison: c }] : [];
  });

  return (
    <>
      <Chapter n={2} id="tastes" title="Four people, four sets of tastes">
        <p>
          Kabir, Tanvi, Sameer and Amma (fictional) each name a few things they love. Amma is vegetarian and keeps to a
          budget. Their words go to Qloo exactly as typed.
        </p>
        <GroupSummary group={record.group} />
      </Chapter>
      <Chapter n={3} id="overlap" title="The overlap">
        <Overlap record={record} />
      </Chapter>
      <Chapter n={4} id="without-with" title="Without Qloo, and with it">
        <ComparisonView comparison={comparison} record={record} />
      </Chapter>
      <Chapter n={5} id="number" title="The number">
        <TheNumber items={items} />
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/g/birthday-with-amma"
            className="rounded-full bg-neutral-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Open the full plan and X-ray
          </Link>
          <Link href="/new" className="rounded-full border border-neutral-400 px-5 py-3 font-medium">
            Plan for your own group
          </Link>
        </div>
      </Chapter>
    </>
  );
}

export default function PresentPage() {
  const sample = getSample(STORY_ID);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-12 px-4 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm opacity-70">
          ← Common Ground
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">From forty messages to one place</h1>
        <p className="text-lg leading-relaxed">
          A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan
          where those tastes overlap.
        </p>
        <p className="text-xs opacity-60">
          The story follows the recorded sample &ldquo;{sample?.group.title}&rdquo;. People are fictional; scores are real Qloo
          data from a real recorded run. Nothing here calls Qloo or a model when you load it.
        </p>
      </header>
      <Chapter n={1} id="deadlock" title="The group chat that never ends">
        <Deadlock />
      </Chapter>
      <Suspense fallback={<p className="text-sm opacity-70">Loading the recorded run…</p>}>
        <Story />
      </Suspense>
    </main>
  );
}

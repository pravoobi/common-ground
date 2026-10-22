import type { Comparison } from "@/lib/agent/compare";
import type { RunRecord } from "@/lib/agent/record";
import { priceLabel, shortName } from "@/lib/plan-text";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : String(Math.round(x * 100)));

/** The judges' test, on screen: the same model without Qloo, next to the Qloo-grounded plan. */
export function ComparisonView({ comparison, record }: { comparison: Comparison; record: RunRecord }) {
  const { baseline, baselinePlace, baselineIssues, scores } = comparison;
  const people = record.group.people;
  const name = (id: string) => shortName(people.find((p) => p.id === id)?.label ?? id);
  const b = scores.baseline;
  const q = scores.qloo;
  const qlooReasons = new Map(record.plan.reasons.map((r) => [r.personId, r]));

  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="compare-heading" className="text-xl font-semibold tracking-tight">
          Without Qloo vs with Qloo
        </h2>
        <p className="mt-1 text-sm opacity-70">
          Same model ({comparison.model}), same group, same writing rules. The only difference: no Qloo tools. Generated once on{" "}
          {comparison.generatedAt.slice(0, 10)} and stored.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs uppercase tracking-wide opacity-60">Without Qloo</p>
          <p className="mt-1 font-medium">
            {baseline.output.place_name}, {baseline.output.area}
          </p>
          {baselinePlace ? (
            <p className="text-xs opacity-60">
              Qloo has it as {baselinePlace.name}
              {baselinePlace.priceLevel ? ` · ${priceLabel(baselinePlace.priceLevel)}` : ""}
              {baselinePlace.address ? ` · ${baselinePlace.address}` : ""}
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">Qloo has no place by this name in {record.group.city}.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {baseline.output.reasons.map((r) => (
              <li key={r.person_id}>
                <span className="font-medium">{name(r.person_id)}:</span> {r.text}
              </li>
            ))}
          </ul>
          {baselineIssues.length > 0 && (
            <ul className="mt-3 text-sm text-amber-800 dark:text-amber-200">
              {baselineIssues.map((i, k) => (
                <li key={k}>
                  {i.verified ? "Breaks" : "Can't check"} {name(i.personId)}&apos;s limit: {i.reason}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs opacity-60">These reasons aren&apos;t checked against any data.</p>
        </div>

        <div className="rounded-xl border-2 border-emerald-500/60 p-4">
          <p className="text-xs uppercase tracking-wide opacity-60">With Qloo (the plan above)</p>
          <p className="mt-1 font-medium">{record.plan.pick?.name}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {people.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{name(p.id)}:</span> {qlooReasons.get(p.id)?.text ?? "—"}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs opacity-60">Every reason cites Qloo evidence; see the X-ray.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-1 text-left text-sm font-medium">How well each pick matches each friend&apos;s tastes</caption>
          <thead>
            <tr className="opacity-60">
              <th className="py-1 pr-3 font-normal">Friend</th>
              <th className="py-1 pr-3 font-normal">Without Qloo</th>
              <th className="py-1 pr-3 font-normal">With Qloo</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">{name(p.id)}</td>
                <td className="py-1 pr-3 tabular-nums">{b ? pct(b.perPerson[p.id]?.percentile) : "not in Qloo"}</td>
                <td className="py-1 pr-3 tabular-nums">{pct(q.perPerson[p.id]?.percentile)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-300 font-medium dark:border-neutral-700">
              <td className="py-1 pr-3">Least happy friend</td>
              <td className="py-1 pr-3 tabular-nums">{b ? pct(b.min) : "—"}</td>
              <td className="py-1 pr-3 tabular-nums">{pct(q.min)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="text-xs opacity-70">
        <summary className="cursor-pointer">How this is measured, and what it doesn&apos;t prove</summary>
        <p className="mt-2">
          Both places are scored the same way: Qloo&apos;s affinity for each friend, from that friend&apos;s own tastes, turned into a
          percentile among the {comparison.poolSize} candidate places plus the no-Qloo pick (100 = their best match there). Raw
          affinities: {people.map((p) => `${name(p.id)} ${b?.perPerson[p.id]?.affinity?.toFixed(3) ?? "—"} vs ${q.perPerson[p.id]?.affinity?.toFixed(3) ?? "—"}`).join("; ")}.
        </p>
        <p className="mt-2">
          This uses Qloo&apos;s own taste model as the yardstick, and the candidate places are Qloo&apos;s recommendations, so it
          shows how far a generic guess is from each friend&apos;s taste profile. It isn&apos;t an independent test of whether
          real people would enjoy the evening more. The parts that need no Qloo score: whether a pick breaks someone&apos;s
          limits, and whether a reason is backed by data.
        </p>
      </details>
    </section>
  );
}

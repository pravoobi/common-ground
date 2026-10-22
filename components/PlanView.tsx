import type { PlaceView, RunRecord } from "@/lib/agent/record";
import { priceLabel, shortName, whatsappLink, whatsappText } from "@/lib/plan-text";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}`);

/** A finished plan: the group-chat card first, then the evidence behind it. */
export function PlanView({ record }: { record: RunRecord }) {
  const { plan, group } = record;
  const name = (id: string) => shortName(group.people.find((p) => p.id === id)?.label ?? id);
  const text = whatsappText(record);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs uppercase tracking-wide opacity-60">
        {record.mode === "replay" ? `Replay of a real run recorded ${record.recordedAt.slice(0, 10)}` : "Live run"} ·{" "}
        {group.city}
      </p>

      <section aria-label="Plan message" className="rounded-2xl bg-[#e7fbd7] p-4 text-neutral-900 shadow-sm dark:bg-[#1f3b2c] dark:text-neutral-100">
        <p className="font-semibold">{plan.headline}</p>
        {plan.pick ? (
          <p className="mt-1 text-sm opacity-80">
            {[plan.pick.name, priceLabel(plan.pick.priceLevel), plan.pick.address].filter(Boolean).join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-sm">No place in {group.city} fit everyone&apos;s limits this time.</p>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {plan.reasons.map((r) => (
            <li key={r.personId} className="text-[15px] leading-snug">
              <span className="font-medium">{name(r.personId)}:</span> {r.text}
              {!r.grounded && <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">(unverified)</span>}
            </li>
          ))}
        </ul>
        {plan.clarifyingQuestion && <p className="mt-3 text-[15px] italic">{plan.clarifyingQuestion}</p>}
      </section>

      <div className="flex flex-wrap gap-3">
        <a
          href={whatsappLink(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Share to WhatsApp
        </a>
      </div>

      {plan.averagingPick && (
        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-medium">Why not just average everyone&apos;s scores?</h3>
          <p className="mt-1 text-sm">
            Averaging would have picked <strong>{plan.averagingPick.name}</strong>, where{" "}
            {plan.averagingPick.leastHappy.map(name).join(" and ")} would be least happy. Common Ground picks the place whose
            least-happy person is happiest.
          </p>
          {plan.fairnessNote && <p className="mt-1 text-sm opacity-80">{plan.fairnessNote}</p>}
        </section>
      )}

      {(plan.assumptions.length > 0 || record.unverified.some((u) => u.candidateId === plan.pick?.id)) && (
        <section className="text-sm">
          <h3 className="font-medium">What the agent assumed or couldn&apos;t check</h3>
          <ul className="mt-1 list-disc pl-5 opacity-80">
            {plan.assumptions.map((a, i) => (
              <li key={i}>
                {name(a.personId)}: {a.text}
              </li>
            ))}
            {record.unverified
              .filter((u) => u.candidateId === plan.pick?.id)
              .map((u, i) => (
                <li key={`u${i}`}>
                  {name(u.personId)}: {u.reason} for {plan.pick?.name} (Qloo has no data on it)
                </li>
              ))}
          </ul>
        </section>
      )}

      <XRay record={record} name={name} />
      <CostReceipt record={record} />
    </div>
  );
}

function XRay({ record, name }: { record: RunRecord; name: (id: string) => string }) {
  const people = record.group.people.map((p) => p.id);
  return (
    <details className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <summary className="cursor-pointer font-medium">X-ray: the Qloo data behind this plan</summary>

      <h4 className="mt-4 text-sm font-medium">1. Tastes matched to Qloo</h4>
      <ul className="mt-1 text-sm">
        {record.tastes.map((t, i) => (
          <li key={i} className="py-0.5">
            {name(t.personId)}: &ldquo;{t.input}&rdquo; →{" "}
            {t.signal ? (
              <span>
                {t.signal.name} <span className="opacity-60">({t.signal.kind === "tag" ? "tag" : t.kind})</span>
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">not matched</span>
            )}
            {t.chosenByAgent && <span className="opacity-60"> · agent chose between options</span>}
            {t.attempts?.length ? (
              <span className="opacity-60"> · after retry (first tried &ldquo;{t.attempts[0].query}&rdquo;: {t.attempts[0].status})</span>
            ) : null}
          </li>
        ))}
      </ul>

      <h4 className="mt-4 text-sm font-medium">2. Fair ranking (each person&apos;s percentile in the pool · Qloo affinity)</h4>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="opacity-60">
              <th className="py-1 pr-3 font-normal">Place</th>
              {people.map((id) => (
                <th key={id} className="py-1 pr-3 font-normal">
                  {name(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {record.ranking.map((p: PlaceView) => (
              <tr key={p.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-1 pr-3">{p.name}</td>
                {people.map((id) => {
                  const s = p.scores[id];
                  return (
                    <td key={id} className={`py-1 pr-3 tabular-nums ${p.leastHappy.includes(id) ? "font-semibold" : ""}`}>
                      {s ? `${pct(s.percentile)} · ${s.affinity?.toFixed(3) ?? "—"}` : "not scored"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs opacity-60">Bold = least happy person for that place. The top row is the pick.</p>

      <h4 className="mt-4 text-sm font-medium">3. Evidence each reason cites</h4>
      <ul className="mt-1 text-sm">
        {record.plan.reasons.map((r) => (
          <li key={r.personId} className="py-0.5">
            {name(r.personId)}: {r.evidence.length ? r.evidence.map((e) => e.text).join("; ") : "none (shown as unverified)"}
          </li>
        ))}
      </ul>

      <h4 className="mt-4 text-sm font-medium">4. Every Qloo call ({record.qlooCalls.length})</h4>
      <ol className="mt-1 flex flex-col gap-1 font-mono text-xs">
        {record.qlooCalls.map((c, i) => (
          <li key={i} className="break-all">
            <span className="opacity-60">{c.status === "cache" ? "cache" : `${c.status} · ${c.ms}ms`}</span> /{c.endpoint}?
            {new URLSearchParams(c.params).toString()}
          </li>
        ))}
      </ol>
    </details>
  );
}

function CostReceipt({ record }: { record: RunRecord }) {
  const cached = record.qlooCalls.filter((c) => c.status === "cache").length;
  const { usage, timings } = record;
  return (
    <p className="text-xs opacity-60">
      Receipt: {record.qlooCalls.length} Qloo calls ({cached} from cache) · {usage.turns} model turns ·{" "}
      {usage.inputTokens.toLocaleString("en-IN")} in / {usage.outputTokens.toLocaleString("en-IN")} out tokens ·{" "}
      {(timings.totalMs / 1000).toFixed(1)} s · {record.model}
    </p>
  );
}

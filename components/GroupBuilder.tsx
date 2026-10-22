"use client";

import { useState } from "react";
import type { RunRecord } from "@/lib/agent/record";
import type { StepEvent } from "@/lib/agent/steps";
import type { GroupInput } from "@/lib/group";
import { PlanView } from "./PlanView";
import { initialSteps, StepRail, type StepState } from "./StepRail";

interface Draft {
  name: string;
  tastes: string;
  veg: boolean;
  maxPrice: "" | "1" | "2" | "3" | "4";
}

const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Hyderabad"];
const blank = (): Draft => ({ name: "", tastes: "", veg: false, maxPrice: "" });

const EXAMPLE: Draft[] = [
  { name: "Asha", tastes: "AR Rahman, Kumbalangi Nights, filter coffee", veg: true, maxPrice: "" },
  { name: "Ravi", tastes: "Diljit Dosanjh, RRR, biryani", veg: false, maxPrice: "3" },
  { name: "Meera", tastes: "Prateek Kuhad, Panchayat, Toit", veg: false, maxPrice: "" },
];

type Phase =
  | { kind: "editing"; error?: string }
  | { kind: "running"; steps: StepState }
  | { kind: "done"; record: RunRecord };

export function toGroup(drafts: Draft[], city: string, occasion: string): GroupInput {
  const used = new Set<string>();
  const people = drafts.map((d, i) => {
    let id = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || `p${i + 1}`;
    while (used.has(id)) id = `${id}-${i + 1}`;
    used.add(id);
    return {
      id,
      label: d.name.trim() || `Friend ${i + 1}`,
      tastes: d.tastes
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
      constraints: {
        ...(d.veg ? { veg: true } : {}),
        ...(d.maxPrice ? { maxPriceLevel: Number(d.maxPrice) as 1 | 2 | 3 | 4 } : {}),
      },
    };
  });
  return { title: `${occasion || "Plan"} in ${city}`, city, occasion: occasion || undefined, people };
}

export function GroupBuilder() {
  const [drafts, setDrafts] = useState<Draft[]>([blank(), blank()]);
  const [city, setCity] = useState("Bengaluru");
  const [occasion, setOccasion] = useState("Saturday dinner");
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });

  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const group = toGroup(drafts, city, occasion);
    const empty = group.people.find((p) => p.tastes.length === 0);
    if (empty) return setPhase({ kind: "editing", error: `Add at least one taste for ${empty.label}.` });

    let steps = initialSteps();
    setPhase({ kind: "running", steps });
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(group),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return setPhase({ kind: "editing", error: body.error ?? `The planner returned ${res.status}.` });
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          if (!raw.startsWith("data: ")) continue;
          const event = JSON.parse(raw.slice(6)) as
            | ({ type: "step" } & StepEvent)
            | { type: "done"; record: RunRecord }
            | { type: "error"; message: string }
            | { type: "cap" };
          if (event.type === "step") {
            steps = { ...steps, [event.step]: { status: event.status === "done" ? "done" : "active", detail: event.detail } };
            setPhase({ kind: "running", steps });
          } else if (event.type === "done") {
            return setPhase({ kind: "done", record: event.record });
          } else if (event.type === "error") {
            return setPhase({ kind: "editing", error: event.message });
          }
        }
      }
      setPhase({ kind: "editing", error: "The connection closed before the plan was ready. Please try again." });
    } catch {
      setPhase({ kind: "editing", error: "Couldn't reach the planner. Check your connection and try again." });
    }
  }

  if (phase.kind === "running") {
    return (
      <div className="flex flex-col gap-4">
        <StepRail steps={phase.steps} />
        <p className="text-sm opacity-70">This takes about 30 seconds: real Qloo lookups for every taste, then one fair pick.</p>
      </div>
    );
  }

  if (phase.kind === "done") {
    return (
      <div className="flex flex-col gap-6">
        <PlanView record={phase.record} />
        <button type="button" onClick={() => setPhase({ kind: "editing" })} className="self-start text-sm underline">
          Edit the group
        </button>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          City
          <select value={city} onChange={(e) => setCity(e.target.value)} className={input}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-sm">
          Occasion
          <input value={occasion} onChange={(e) => setOccasion(e.target.value)} maxLength={80} className={input} />
        </label>
      </div>

      {drafts.map((d, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <legend className="px-1 text-sm font-medium">Friend {i + 1}</legend>
          <input
            aria-label={`Friend ${i + 1} name`}
            placeholder="Name"
            value={d.name}
            maxLength={40}
            onChange={(e) => update(i, { name: e.target.value })}
            className={input}
          />
          <textarea
            aria-label={`Friend ${i + 1} tastes`}
            placeholder="Artists, films, shows, places, dishes (comma separated)"
            value={d.tastes}
            rows={2}
            onChange={(e) => update(i, { tastes: e.target.value })}
            className={input}
          />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={d.veg} onChange={(e) => update(i, { veg: e.target.checked })} />
              Vegetarian
            </label>
            <label className="flex items-center gap-2">
              Budget up to
              <select value={d.maxPrice} onChange={(e) => update(i, { maxPrice: e.target.value as Draft["maxPrice"] })} className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700">
                <option value="">any</option>
                <option value="1">₹</option>
                <option value="2">₹₹</option>
                <option value="3">₹₹₹</option>
                <option value="4">₹₹₹₹</option>
              </select>
            </label>
            {drafts.length > 2 && (
              <button type="button" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} className="ml-auto underline opacity-70">
                Remove
              </button>
            )}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-3 text-sm">
        {drafts.length < 4 && (
          <button type="button" onClick={() => setDrafts((ds) => [...ds, blank()])} className="underline">
            Add a friend
          </button>
        )}
        <button type="button" onClick={() => setDrafts(EXAMPLE)} className="underline">
          Fill in an example
        </button>
      </div>

      {phase.error && (
        <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          {phase.error}
        </p>
      )}

      <button type="submit" className="rounded-full bg-neutral-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-neutral-900">
        Find our common ground
      </button>
      <p className="text-xs opacity-60">
        Live runs use real Qloo and Claude calls, so they&apos;re limited to a few per person per day. Names and tastes aren&apos;t
        stored.
      </p>
    </form>
  );
}

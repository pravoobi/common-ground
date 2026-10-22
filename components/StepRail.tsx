import type { StepName } from "@/lib/agent/steps";

export type StepStatus = "idle" | "active" | "done";
export type StepState = Record<StepName, { status: StepStatus; detail?: string }>;

const STEPS: { name: StepName; label: string }[] = [
  { name: "resolve", label: "Resolving tastes" },
  { name: "overlap", label: "Finding overlap" },
  { name: "plan", label: "Building the plan" },
];

export const initialSteps = (): StepState => ({
  resolve: { status: "idle" },
  overlap: { status: "idle" },
  plan: { status: "idle" },
});

/** Each step lights up when the real Qloo calls behind it return. */
export function StepRail({ steps }: { steps: StepState }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Progress">
      {STEPS.map(({ name, label }) => {
        const { status, detail } = steps[name];
        return (
          <li key={name} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                status === "done"
                  ? "bg-emerald-500"
                  : status === "active"
                    ? "animate-pulse bg-amber-400"
                    : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            />
            <div className={status === "idle" ? "opacity-50" : ""}>
              <p className="font-medium">
                {label}
                <span className="sr-only"> ({status})</span>
              </p>
              {detail && <p className="text-sm opacity-70">{detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

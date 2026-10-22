import type { GroupInput } from "@/lib/group";
import { priceLabel, shortName } from "@/lib/plan-text";

/** Who's coming: each person's tastes as typed, and their hard limits. */
export function GroupSummary({ group }: { group: GroupInput }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {group.people.map((p) => (
        <li key={p.id} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <p className="font-medium">{shortName(p.label)}</p>
          <p className="opacity-80">{p.tastes.join(" · ")}</p>
          {(p.constraints.veg || p.constraints.maxPriceLevel) && (
            <p className="mt-1 text-xs opacity-60">
              {[p.constraints.veg && "vegetarian", p.constraints.maxPriceLevel && `up to ${priceLabel(p.constraints.maxPriceLevel)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

import type { RunRecord } from "./agent/record";

/** Display name without the "(fictional)" marker used in samples. */
export function shortName(label: string): string {
  return label.replace(/\s*\(fictional\)\s*$/i, "");
}

export function priceLabel(level?: number): string {
  return level && level >= 1 && level <= 4 ? "₹".repeat(level) : "";
}

/** The plan as a WhatsApp message: place, then one line per friend. Uses only stored plan data. */
export function whatsappText(record: Pick<RunRecord, "group" | "plan">, link?: string): string {
  const { plan, group } = record;
  if (!plan.pick) return `${plan.headline}\n\nNo place in ${group.city} fit everyone's limits this time.`;
  const names = new Map(group.people.map((p) => [p.id, shortName(p.label)]));
  const lines = [
    `*${plan.headline}*`,
    [plan.pick.name, priceLabel(plan.pick.priceLevel), plan.pick.address].filter(Boolean).join(" · "),
    "",
    ...plan.reasons.map((r) => `• ${names.get(r.personId) ?? r.personId}: ${r.text}`),
  ];
  if (plan.clarifyingQuestion) lines.push("", plan.clarifyingQuestion);
  lines.push("", `Picked with Common Ground, from each of our tastes on the Qloo taste graph${link ? `: ${link}` : "."}`);
  return lines.join("\n");
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

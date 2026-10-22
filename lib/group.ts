import { z } from "zod";

/** What a group sends in: people, their tastes as free text, and hard constraints. */
export const PersonInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,24}$/),
  label: z.string().min(1).max(40),
  /** Free text: artists, films, shows, places, dishes. Classified by the agent. */
  tastes: z.array(z.string().min(1).max(80)).min(1).max(6),
  constraints: z
    .object({
      veg: z.boolean().optional(),
      maxPriceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    })
    .default({}),
});
export type PersonInput = z.infer<typeof PersonInput>;

export const GroupInput = z.object({
  title: z.string().min(1).max(80),
  city: z.string().min(1).max(40),
  /** e.g. "Saturday dinner". Only used in the message text. */
  occasion: z.string().max(80).optional(),
  people: z
    .array(PersonInput)
    .min(2)
    .max(4)
    .refine((ps) => new Set(ps.map((p) => p.id)).size === ps.length, "Each person needs a different id"),
});
export type GroupInput = z.infer<typeof GroupInput>;

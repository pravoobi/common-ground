import birthday from "@/data/groups/birthday-with-amma.json";
import college from "@/data/groups/college-friends.json";
import couple from "@/data/groups/couple-date-night.json";
import { GroupInput } from "./group";

/** Fictional sample groups. Their runs are recorded once and replayed from Redis (lib/replays.ts). */
export const SAMPLES = [
  {
    id: "college-friends",
    blurb: "Four friends, twelve tastes across music, film, shows and food. Watch the agent recover from “Sid Sriram's new song” and choose between two Anirudhs.",
    group: GroupInput.parse(college),
  },
  {
    id: "couple-date-night",
    blurb: "Two people with opposite tastes, one of them vegetarian. One place has to work for both.",
    group: GroupInput.parse(couple),
  },
  {
    id: "birthday-with-amma",
    blurb: "Three flatmates who love bars, and Amma, who loves Carnatic music and filter coffee. Where fairness and averaging part ways.",
    group: GroupInput.parse(birthday),
  },
] as const;

export type SampleId = (typeof SAMPLES)[number]["id"];

export function getSample(id: string) {
  return SAMPLES.find((s) => s.id === id);
}

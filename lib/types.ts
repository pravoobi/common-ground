// Core domain types. Qloo-facing fields are provisional until spike 1 (see SPIKES.md).

/** ₹ to ₹₹₹₹. */
export type PriceLevel = 1 | 2 | 3 | 4;

export interface PersonConstraints {
  /** Needs vegetarian food. */
  veg?: boolean;
  /** Highest price level this person is happy with. */
  maxPriceLevel?: PriceLevel;
  /** Furthest this person will travel, in km. */
  maxDistanceKm?: number;
}

export interface Person {
  id: string;
  label: string;
  constraints: PersonConstraints;
}

/** A place or title that could go in the plan. Unknown attributes stay undefined; never guessed. */
export interface Candidate {
  id: string;
  name: string;
  priceLevel?: PriceLevel;
  distanceKm?: number;
  vegFriendly?: boolean;
  tags: string[];
}

/**
 * Affinity of each candidate for each person, as returned by Qloo.
 * `null` (or a missing entry) means Qloo gave no score; it is never filled in.
 */
export type AffinityTable = Record<string, Record<string, number | null>>;

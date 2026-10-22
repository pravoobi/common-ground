import { z } from "zod";

// Only the fields we use. Unknown fields are dropped, which also keeps cached payloads small.
// Shapes verified against real responses in spikes 1–6 (SPIKES.md).

/** `/search` returns `tag_id`; `/v2/insights` and `/v2/tags` return `id`. */
const Tag = z
  .object({ id: z.string().optional(), tag_id: z.string().optional(), name: z.string(), type: z.string().optional() })
  .transform(({ id, tag_id, name, type }) => ({ id: id ?? tag_id ?? "", name, type }));

const Geocode = z.object({
  city: z.string().nullish(),
  name: z.string().nullish(),
  admin1_region: z.string().nullish(),
  country_code: z.string().nullish(),
});

const Properties = z
  .object({
    price_level: z.number().nullish(),
    address: z.string().nullish(),
    geocode: Geocode.nullish(),
    short_description: z.string().nullish(),
    cuisine_description: z.string().nullish(),
    ambience_description: z.string().nullish(),
    specialty_dishes: z.array(z.object({ name: z.string() })).nullish(),
    image: z.object({ url: z.string() }).nullish(),
  })
  .partial();

export const Entity = z.object({
  entity_id: z.string(),
  name: z.string(),
  types: z.array(z.string()).optional(),
  subtype: z.string().nullish(),
  popularity: z.number().nullish(),
  properties: Properties.nullish(),
  location: z.object({ lat: z.number(), lon: z.number() }).nullish(),
  tags: z.array(Tag).nullish(),
});
export type Entity = z.infer<typeof Entity>;

export const SearchResponse = z.object({ results: z.array(Entity) });

export const TagsResponse = z.object({
  results: z.object({ tags: z.array(Tag) }),
});
export type QlooTag = z.infer<typeof TagsResponse>["results"]["tags"][number];

const Contribution = z.object({ entity_id: z.string(), score: z.number() });

export const InsightEntity = Entity.extend({
  query: z
    .object({
      affinity: z.number().nullish(),
      explainability: z
        .object({ "signal.interests.entities": z.array(Contribution).optional() })
        .nullish(),
    })
    .nullish(),
});
export type InsightEntity = z.infer<typeof InsightEntity>;

export const InsightsResponse = z.object({
  success: z.boolean().optional(),
  results: z.object({ entities: z.array(InsightEntity) }),
});

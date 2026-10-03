import { unstable_cache } from "next/cache";

import { fetchStandings } from "@/lib/balldontlie/endpoints";
import { groupStandings, type ConferenceStandings } from "@/lib/standings/standings";

// Standings move a few times a night at most; an hour keeps homepage loads off
// the API without showing stale ranks for long.
const cachedStandings = unstable_cache(
  async (): Promise<ConferenceStandings> => groupStandings({ rows: await fetchStandings() }),
  ["home:standings"],
  { revalidate: 3600, tags: ["standings"] },
);

// The catch sits outside the cache on purpose: a thrown fetch is never stored,
// so an API outage costs one page load its panel instead of poisoning the
// cache with an empty hour.
export const getConferenceStandings = async (): Promise<ConferenceStandings | null> => {
  try {
    return await cachedStandings();
  } catch {
    return null;
  }
};

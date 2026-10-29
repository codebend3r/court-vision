import { createLoader } from "nuqs/server";

import { listParsers } from "@/lib/players/searchParams";

// The Roster Advisor's URL state: the game range its pool is valued over. A
// new range is a new server pool, so it refetches.
export const advisorParsers = {
  range: listParsers.range.withOptions({ shallow: false }),
};

export const loadAdvisorSearchParams = createLoader(advisorParsers);

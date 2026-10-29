import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { listParsers } from "@/lib/players/searchParams";

export const ADVISOR_TABS = ["trades", "free_agents", "trending"] as const;
export type AdvisorTab = (typeof ADVISOR_TABS)[number];

export const ADVISOR_TAB_LABELS: Record<AdvisorTab, string> = {
  trades: "Trades",
  free_agents: "Free agent pickups",
  trending: "Trending",
};

// The Roster Advisor's URL state: the game range its pool is valued over (a
// new range is a new server pool, so it refetches), the open tab, the
// category in focus (absent for every weak one) and the best fit the trades
// are for (absent for the top one). The engine ignores a stale need or target.
export const advisorParsers = {
  range: listParsers.range.withOptions({ shallow: false }),
  tab: parseAsStringLiteral(ADVISOR_TABS).withDefault("trades"),
  need: parseAsString,
  target: parseAsInteger,
};

export const loadAdvisorSearchParams = createLoader(advisorParsers);

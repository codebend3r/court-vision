import { createSportEngine } from "@vision/core/engine";

import { hockey } from "#hockey/descriptor";

// The shared engine bound to hockey.
export const hockeyEngine = createSportEngine({ sport: hockey });

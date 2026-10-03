import { createSportEngine } from "@vision/core/engine";

import { football } from "#football/descriptor";

// The shared engine bound to football.
export const footballEngine = createSportEngine({ sport: football });

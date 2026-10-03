import { createSportEngine } from "@vision/core/engine";

import { baseball } from "#baseball/descriptor";

// The shared engine bound to baseball.
export const baseballEngine = createSportEngine({ sport: baseball });

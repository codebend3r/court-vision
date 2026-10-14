import {
  makeStatLine as makeCoreStatLine,
  type FixtureOverrides,
} from "@vision/core/testing/basketball";

import { type FantasyStatLine } from "@/lib/valuation/types";

export { type FixtureOverrides };

// Test fixture builder, with flat overrides so tests stay short:
// `makeStatLine({ playerId: 1, pts: 900 })` rather than nesting a stats record.
// It is core's own basketball builder, typed as the app's stat line: core's
// fixture descriptor matches the shipped one field for field, which
// `@vision/sport-basketball`'s drift test holds it to.
export const makeStatLine: (overrides: FixtureOverrides) => FantasyStatLine = makeCoreStatLine;

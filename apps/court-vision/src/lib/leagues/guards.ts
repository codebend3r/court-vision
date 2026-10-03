import { type LeagueMutationResult } from "@/lib/leagues/types";

export { isLeagueScoringType } from "@vision/core/league/scoring";

// The shared scoring-config guards, bound to basketball's categories and
// points table.
export {
  defaultScoringConfig,
  isH2hCategoriesConfig,
  isH2hPointsConfig,
  isRotoConfig,
  parseScoringConfig,
} from "@vision/sport-basketball/engine";

export const isLeagueMutationResult = (value: unknown): value is LeagueMutationResult => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  if (record.status === "ok") return typeof record.league === "object" && record.league !== null;
  return (
    record.status === "limit" ||
    record.status === "invalid" ||
    record.status === "unauthenticated" ||
    record.status === "error"
  );
};

// The per-game spine every player-page chart series shares: the regular
// box-score series, the advanced-metric series, and the fantasy value trend
// all extend it, which is what lets one line-chart component draw all three.
export type MetricPoint = {
  gameIndex: number;
  gameDate: string;
  matchup: string;
  winLoss: string | null;
  dnp: boolean;
};

export const isMetricPoint = (value: unknown): value is MetricPoint => {
  if (typeof value !== "object" || value === null) return false;
  return (
    "gameIndex" in value &&
    typeof value.gameIndex === "number" &&
    "gameDate" in value &&
    typeof value.gameDate === "string" &&
    "matchup" in value &&
    typeof value.matchup === "string" &&
    "winLoss" in value &&
    (typeof value.winLoss === "string" || value.winLoss === null) &&
    "dnp" in value &&
    typeof value.dnp === "boolean"
  );
};

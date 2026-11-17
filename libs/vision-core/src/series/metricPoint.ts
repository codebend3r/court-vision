import { isRecord } from "#core/util/record";

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

export const isMetricPoint = (value: unknown): value is MetricPoint =>
  isRecord(value) &&
  typeof value.gameIndex === "number" &&
  typeof value.gameDate === "string" &&
  typeof value.matchup === "string" &&
  (typeof value.winLoss === "string" || value.winLoss === null) &&
  typeof value.dnp === "boolean";

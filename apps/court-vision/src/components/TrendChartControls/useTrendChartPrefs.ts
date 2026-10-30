"use client";

import { parseAsArrayOf, parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";

import { METHOD_VALUE_KEYS } from "@vision/core/valuation/registry";
import { type MethodValueKey } from "@vision/core/valuation/types";

// Every rolling chart's view settings, shared through the URL so the controls
// and every chart on the page agree, and a link reopens the same view:
// `?hide=g,sgp` hides method charts (all seven show by default) and `?avg=false`
// hides the league-average line (shown by default).
const hiddenParser = parseAsArrayOf(parseAsStringLiteral(METHOD_VALUE_KEYS))
  .withDefault([])
  .withOptions({ history: "replace" });
const showAverageParser = parseAsBoolean.withDefault(true).withOptions({ history: "replace" });

export type TrendChartPrefs = {
  hidden: MethodValueKey[];
  setHidden: (next: MethodValueKey[]) => void;
  showAverage: boolean;
  setShowAverage: (next: boolean) => void;
};

export const useTrendChartPrefs = (): TrendChartPrefs => {
  const [hidden, setHidden] = useQueryState("hide", hiddenParser);
  const [showAverage, setShowAverage] = useQueryState("avg", showAverageParser);
  return {
    hidden,
    setHidden: (next) => void setHidden(next),
    showAverage,
    setShowAverage: (next) => void setShowAverage(next),
  };
};

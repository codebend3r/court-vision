"use client";

import { parseAsArrayOf, parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";

import { visibleMethods } from "@/lib/charts/trendMethods";
import { type DatedMethodValues } from "@vision/core/valuation/leagueAverage";
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

// The league's average on every method, by game date (epoch ms).
export type AverageByDate = ReadonlyMap<number, DatedMethodValues["values"]>;

export type TrendChartView = {
  // The method charts left showing; never empty.
  keys: MethodValueKey[];
  // Null while the average line is hidden or before the league has a
  // reading, so no line is drawn at all.
  averageByDate: AverageByDate | null;
};

// What a rolling chart draws under the shared settings.
type UseTrendChartViewProps = { averages: readonly DatedMethodValues[] };

export const useTrendChartView = ({ averages }: UseTrendChartViewProps): TrendChartView => {
  const { hidden, showAverage } = useTrendChartPrefs();
  return {
    keys: visibleMethods({ hidden }),
    averageByDate:
      showAverage && !!averages.length
        ? new Map(averages.map(({ date, values }) => [date, values]))
        : null,
  };
};

// The league's average on one method for one game date (epoch ms), or null
// when there is no line to draw or no reading that day.
type AverageOnProps = {
  averageByDate: AverageByDate | null;
  date: number;
  key: MethodValueKey;
};

export const averageOn = ({ averageByDate, date, key }: AverageOnProps): number | null =>
  averageByDate?.get(date)?.[key] ?? null;

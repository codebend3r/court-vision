"use client";

import { type ChangeEvent, useId, useMemo } from "react";
import { useQueryStates } from "nuqs";

import { FreeAgentsPanel } from "@/components/AdvisorView/FreeAgentsPanel";
import { NeedsPanel } from "@/components/AdvisorView/NeedsPanel";
import { TargetsPanel } from "@/components/AdvisorView/TargetsPanel";
import { TradesPanel } from "@/components/AdvisorView/TradesPanel";
import { TrendingPanel } from "@/components/AdvisorView/TrendingPanel";
import { useValuation } from "@/components/FantasyValueView/useValuation";
import { KeycapTabs } from "@/components/KeycapTabs/KeycapTabs";
import { buildAdvice } from "@/lib/advisor/advice";
import {
  ADVISOR_TAB_LABELS,
  ADVISOR_TABS,
  type AdvisorTab,
  advisorParsers,
} from "@/lib/advisor/searchParams";
import { buildTrending, freePlayerIds, type TrendLines } from "@/lib/advisor/trending";
import { type AdvisorFocus, type AdvisorLeagueData } from "@/lib/advisor/types";
import {
  GAME_RANGE_LABELS,
  gamesForRange,
  isPlayerGameRange,
  PLAYER_GAME_RANGES,
  type PlayerGameRange,
} from "@/lib/players/searchParams";
import { type FantasyStatLine } from "@/lib/valuation/types";
import { unmatchedNotice } from "@/lib/waiverWire/format";
import { scoreKeysFor } from "@/lib/waiverWire/model";
import { formatOrdinal } from "@vision/core/util/format";
import { type FantasyMethodKey } from "@vision/core/valuation/types";
import { buildCategoryBreakdown } from "@vision/sport-basketball/engine";
import {
  type FantasyCategoryBreakdown,
  type MethodWeights,
  type ValuationConfig,
} from "@vision/sport-basketball/types";

import styles from "@/components/AdvisorView/AdvisorView.module.scss";

export type AdvisorViewProps = {
  // The range the server loaded `lines` for; see WaiverWireView.
  range: PlayerGameRange;
  lines: FantasyStatLine[];
  // The free players' season and last-ten lines, for the Trending tab.
  trendLines: TrendLines;
  league: AdvisorLeagueData;
  activePlayerIds: number[];
  config: ValuationConfig;
  methodWeights: MethodWeights;
  method: FantasyMethodKey;
};

export const NO_ADVICE = "No valued players on your roster in this range yet.";

// Client orchestrator: values the range's pool once, in the worker, the way
// the Waiver Wire does, then hands it to the advisor engine. The weak
// categories and their best fits sit over three tabs: trades for the chosen
// fit, free agent pickups, and the free agents trending up. Only a new range
// goes back to the server.
export function AdvisorView({
  range,
  lines,
  trendLines,
  league,
  activePlayerIds,
  config,
  methodWeights,
  method,
}: AdvisorViewProps) {
  const rangeId = useId();
  const [query, setQuery] = useQueryStates(advisorParsers);
  const { valueKey, scoreKey } = scoreKeysFor({ method });
  const valuation = useValuation({
    lines,
    config,
    methodWeights,
    windowGames: gamesForRange({ range }),
  });

  const activeIds = useMemo(() => new Set(activePlayerIds), [activePlayerIds]);
  const linesById = useMemo(
    () => new Map(valuation.lines.map((line) => [line.playerId, line])),
    [valuation.lines],
  );
  const { poolStats, config: settledConfig, methodWeights: settledWeights } = valuation;
  type LineBreakdownProps = { line: FantasyStatLine };

  // Any line against the settled pool, so a recent line and a season line
  // land on the same yardstick.
  const lineBreakdown = useMemo(
    () =>
      ({ line }: LineBreakdownProps): FantasyCategoryBreakdown[] =>
        buildCategoryBreakdown({
          line,
          poolStats,
          config: settledConfig,
          methodWeights: settledWeights,
        }),
    [poolStats, settledConfig, settledWeights],
  );
  type BreakdownForProps = { playerId: number };

  // Memoized per player: the engine asks for the same breakdown many times.
  const breakdownFor = useMemo(() => {
    const cache = new Map<number, FantasyCategoryBreakdown[]>();
    return ({ playerId }: BreakdownForProps): FantasyCategoryBreakdown[] => {
      const cached = cache.get(playerId);
      if (cached !== undefined) return cached;
      const line = linesById.get(playerId);
      const breakdown = line ? lineBreakdown({ line }) : [];
      cache.set(playerId, breakdown);
      return breakdown;
    };
  }, [linesById, lineBreakdown]);

  const advice = useMemo(
    () =>
      buildAdvice({
        lines: valuation.lines,
        values: valuation.values,
        valueKey,
        league,
        activePlayerIds: activeIds,
        breakdownFor,
        scoreKey,
        focus: query.need,
        targetId: query.target,
      }),
    [
      valuation.lines,
      valuation.values,
      valueKey,
      league,
      activeIds,
      breakdownFor,
      scoreKey,
      query.need,
      query.target,
    ],
  );

  const trending = useMemo(
    () =>
      buildTrending({
        lines: trendLines,
        freeIds: freePlayerIds({ league, activePlayerIds }),
        waivers: league.waivers,
        scoreLine: ({ line }) =>
          lineBreakdown({ line }).reduce((sum, entry) => sum + entry[scoreKey], 0),
      }),
    [trendLines, league, activePlayerIds, lineBreakdown, scoreKey],
  );

  const onRange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (!isPlayerGameRange(next)) return;
    void setQuery({ range: next });
  };

  // A new focus starts from its own best fit.
  type OnFocusProps = { focus: AdvisorFocus };

  const onFocus = ({ focus }: OnFocusProps) => {
    void setQuery({ need: focus === "all" ? null : focus, target: null }, { history: "replace" });
  };

  // Choosing a fit shows its trades.
  type OnTargetProps = { playerId: number };

  const onTarget = ({ playerId }: OnTargetProps) => {
    void setQuery({ target: playerId, tab: "trades" }, { history: "replace" });
  };

  type OnTabProps = { view: AdvisorTab };

  const onTab = ({ view }: OnTabProps) => {
    void setQuery({ tab: view }, { history: "replace" });
  };

  // Quiet while the worker values a new pool; it speaks once the values land.
  const announcement = valuation.isPending
    ? ""
    : advice === null
      ? NO_ADVICE
      : `Weakest in ${advice.weakNeeds.map(({ label, rank, of }) => `${label} (${formatOrdinal({ value: rank })} of ${of})`).join(", ")}. Best fits for ${advice.focusLabel}: ${advice.targets.length}`;

  return (
    <section className={styles.view} aria-label="Roster Advisor" aria-busy={valuation.isPending}>
      <div className={styles.controls}>
        <label className={styles.field} htmlFor={rangeId}>
          Range
          <select id={rangeId} className={styles.select} value={query.range} onChange={onRange}>
            {PLAYER_GAME_RANGES.map((entry) => (
              <option key={entry} value={entry}>
                {GAME_RANGE_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {league.unmatched.length > 0 && (
        <p className={styles.hint}>{unmatchedNotice({ unmatched: league.unmatched })}</p>
      )}
      {advice === null ? (
        <p className={styles.message}>{NO_ADVICE}</p>
      ) : (
        <>
          <NeedsPanel advice={advice} onFocus={onFocus} />
          <TargetsPanel advice={advice} onTarget={onTarget} />
        </>
      )}
      <KeycapTabs
        label="Ways to fix it"
        tabs={ADVISOR_TABS}
        labels={ADVISOR_TAB_LABELS}
        view={query.tab}
        onChange={onTab}
        panels={{
          trades:
            advice === null ? (
              <p className={styles.message}>{NO_ADVICE}</p>
            ) : (
              <TradesPanel
                target={advice.target}
                trades={advice.trades}
                label={advice.focusLabel}
              />
            ),
          free_agents:
            advice === null ? (
              <p className={styles.message}>{NO_ADVICE}</p>
            ) : (
              <FreeAgentsPanel
                freeAgents={advice.freeAgents}
                drop={advice.drop}
                label={advice.focusLabel}
              />
            ),
          trending: <TrendingPanel rows={trending} />,
        }}
      />
      <p role="status" className={styles.srOnly}>
        {announcement}
      </p>
    </section>
  );
}

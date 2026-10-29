"use client";

import { type ChangeEvent, useId, useMemo } from "react";
import { useQueryStates } from "nuqs";

import { FreeAgentsPanel } from "@/components/AdvisorView/FreeAgentsPanel";
import { PlayerName } from "@/components/AdvisorView/PlayerName";
import { TradesPanel } from "@/components/AdvisorView/TradesPanel";
import { TrendingPanel } from "@/components/AdvisorView/TrendingPanel";
import { useValuation } from "@/components/FantasyValueView/useValuation";
import { KeycapTabs } from "@/components/KeycapTabs/KeycapTabs";
import { buildAdvice } from "@/lib/advisor/advice";
import { formatScore, ownerText } from "@/lib/advisor/format";
import {
  ADVISOR_TAB_LABELS,
  ADVISOR_TABS,
  type AdvisorTab,
  advisorParsers,
} from "@/lib/advisor/searchParams";
import { buildTrending, freePlayerIds, type TrendLines } from "@/lib/advisor/trending";
import { type Advice, type AdvisorLeagueData } from "@/lib/advisor/types";
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

// The weakness and the player who fixes it: what every tab works from.
type SummaryPanelsProps = { advice: Advice };

function SummaryPanels({ advice }: SummaryPanelsProps) {
  const { weakness, target } = advice;
  const label = weakness.label;
  return (
    <>
      <section className={styles.panel} aria-labelledby="advisor-weakness">
        <h2 id="advisor-weakness" className={styles.panelTitle}>
          Biggest weakness
        </h2>
        <p className={styles.readout}>
          <span className={styles.readoutValue}>{label}</span>
          <span className={styles.readoutRank}>
            {formatOrdinal({ value: weakness.rank })} of {weakness.of}
          </span>
        </p>
        <p className={styles.hint}>
          Your healthy roster scores {formatScore({ value: weakness.myTotal })} in {label}; the
          league averages {formatScore({ value: weakness.leagueAverage })}.
        </p>
        <ol className={styles.needs} aria-label="Every category, weakest first">
          {advice.needs.map((need) => (
            <li
              key={need.key}
              className={styles.need}
              data-weakest={need.key === weakness.key || undefined}
            >
              <span className={styles.needLabel}>{need.label}</span>
              <span className={styles.needRank}>
                {formatOrdinal({ value: need.rank })}
                <span className={styles.hint}> of {need.of}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className={styles.panel} aria-labelledby="advisor-target">
        <h2 id="advisor-target" className={styles.panelTitle}>
          Best fit for {label}
        </h2>
        {target === null ? (
          <p className={styles.message}>Nobody outside your team is valued in this range.</p>
        ) : (
          <div className={styles.target}>
            <PlayerName player={target} />
            <p className={styles.hint}>
              {ownerText({ owner: target.owner })} · {label}{" "}
              {formatScore({ value: target.categoryScore })} · value{" "}
              {formatScore({ value: target.value })}
            </p>
          </div>
        )}
      </section>
    </>
  );
}

// Client orchestrator: values the range's pool once, in the worker, the way
// the Waiver Wire does, then hands it to the advisor engine. The weakness and
// its best fit sit over three tabs: trades, free agent pickups, and the free
// agents trending up. Only a new range goes back to the server.
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
      }),
    [valuation.lines, valuation.values, valueKey, league, activeIds, breakdownFor, scoreKey],
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

  type OnTabProps = { view: AdvisorTab };

  const onTab = ({ view }: OnTabProps) => {
    void setQuery({ tab: view }, { history: "replace" });
  };

  // Quiet while the worker values a new pool; it speaks once the values land.
  const announcement = valuation.isPending
    ? ""
    : advice === null
      ? NO_ADVICE
      : `Biggest weakness: ${advice.weakness.label}, ${formatOrdinal({ value: advice.weakness.rank })} of ${advice.weakness.of}`;

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
        <SummaryPanels advice={advice} />
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
                label={advice.weakness.label}
              />
            ),
          free_agents:
            advice === null ? (
              <p className={styles.message}>{NO_ADVICE}</p>
            ) : (
              <FreeAgentsPanel
                freeAgents={advice.freeAgents}
                drop={advice.drop}
                label={advice.weakness.label}
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

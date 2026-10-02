import type { ReactNode } from "react";
import type { PlayerGameLog } from "@generated/prisma/client";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import { PlayerAdvancedChart } from "@/components/PlayerAdvancedChart/PlayerAdvancedChart";
import { PlayerFantasyChart } from "@/components/PlayerFantasyChart/PlayerFantasyChart";
import type {
  PlayerGameLogTableProps,
  PlayerGameLogTableRow,
} from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
import { getProfile } from "@/lib/auth/session";
import { SEASON_TYPE } from "@/lib/balldontlie/constants";
import { buildLeagueSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import { averageAdvancedLogs } from "@/lib/players/searchAdvanced";
import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonAverageStat,
  type SeasonStatTotals,
} from "@/lib/players/seasonAverages";
import { getSeasonStatsPool } from "@/lib/players/seasonPool";
import { prisma } from "@/lib/prisma";
import {
  ADVANCED_MODES,
  buildAdvancedSeries,
  pickAdvancedMetrics,
  toAdvancedMode,
} from "@/lib/stats/advancedSeries";
import { buildStatSeries } from "@/lib/stats/cumulative";
import {
  CAREER,
  gamesForSpan,
  rangeForSpan,
  spanLabel,
  type PlayerView,
  type StatMode,
  type StatSpan,
} from "@/lib/stats/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import { buildPlayerFantasyProfile, configFromSeed } from "@/lib/valuation/playerValue";
import { ENABLED_METHODS } from "@/lib/valuation/registry";

import styles from "@/app/players/[playerId]/page.module.scss";

type PlayerViewArgs = {
  view: PlayerView;
  playerId: number;
  selection: string;
  seasonLabel: string;
  seasonRows: readonly SeasonStatTotals[];
  logs: PlayerGameLog[];
  mode: StatMode;
  span: StatSpan;
};

type ViewContext = PlayerViewArgs & {
  isCareer: boolean;
  windowGames: number | null;
  windowLabel: string;
  windowLogs: PlayerGameLog[];
  rows: Array<PlayerGameLogTableRow & Pick<PlayerGameLog, "gameId">>;
};

type PlayerViewResult = {
  card: ReactNode;
  content: ReactNode;
  gameLog: PlayerGameLogTableProps;
};

const loadRegularView = async (context: ViewContext): Promise<PlayerViewResult> => {
  const { playerId, selection, isCareer, seasonRows, seasonLabel, windowLogs, mode, rows } =
    context;
  const totals = isCareer ? aggregateCareerTotals({ rows: seasonRows, playerId }) : null;
  const stats = isCareer
    ? totals === null
      ? []
      : buildCareerAverageLine({ totals })
    : (buildSeasonAverageLine({
        rows: await getSeasonStatsPool({ season: selection, seasonType: SEASON_TYPE }),
        playerId,
      }) ?? []);
  return {
    card: stats.length > 0 && (
      <SeasonStatCard
        season={seasonLabel}
        stats={stats}
        title={isCareer ? "Career averages" : "Season averages"}
      />
    ),
    content: (
      <>
        <PlayerStatFilters />
        <PlayerStatChart series={buildStatSeries({ logs: windowLogs, mode })} mode={mode} />
      </>
    ),
    gameLog: { rows },
  };
};

const loadAdvancedView = async (context: ViewContext): Promise<PlayerViewResult> => {
  const { playerId, selection, isCareer, seasonLabel, windowLabel, logs, windowLogs, mode, rows } =
    context;
  const advancedLogs =
    logs.length === 0
      ? []
      : await prisma.playerAdvancedGameLog.findMany({
          where: isCareer ? { playerId } : { playerId, season: selection },
          orderBy: { gameDate: "asc" },
        });
  const byGame = new Map(
    advancedLogs.map((row) => [row.gameId, pickAdvancedMetrics({ log: row })]),
  );
  const gameIds = new Set(windowLogs.map((log) => log.gameId));
  const windowAdvanced = advancedLogs.filter((row) => gameIds.has(row.gameId));
  const averages = averageAdvancedLogs({ logs: windowAdvanced });
  const stats = ADVANCED_STAT_META.filter((meta) => averages[meta.key] !== null).map(
    (meta): SeasonAverageStat => ({
      key: meta.key,
      label: meta.label,
      value: formatAdvancedStat({ key: meta.key, value: averages[meta.key] }),
      rank: null,
      rankTone: "leader",
      eligibleCount: 0,
    }),
  );
  const advancedMode = toAdvancedMode({ mode });
  return {
    card: stats.length > 0 && (
      <SeasonStatCard
        season={`${seasonLabel} · ${windowLabel}`}
        stats={stats}
        title="Advanced averages"
      />
    ),
    content: (
      <>
        <PlayerStatFilters modes={ADVANCED_MODES} />
        {stats.length === 0 ? (
          <p className={styles.empty}>No advanced stats recorded for this timeframe yet.</p>
        ) : (
          <PlayerAdvancedChart
            series={buildAdvancedSeries({
              logs: windowLogs,
              advancedLogs: windowAdvanced,
              mode: advancedMode,
            })}
            mode={advancedMode}
          />
        )}
        <AdvancedStatsLegend />
      </>
    ),
    gameLog: {
      view: "advanced",
      rows: rows.map((row) => ({ ...row, advanced: byGame.get(row.gameId) ?? null })),
    },
  };
};

const loadFantasyView = async (context: ViewContext): Promise<PlayerViewResult> => {
  const { playerId, selection, isCareer, seasonLabel, windowLabel, windowGames, span, logs, rows } =
    context;
  if (isCareer || logs.length === 0) {
    return {
      card: null,
      content: (
        <>
          <PlayerStatFilters modes={[]} />
          <p className={styles.empty}>
            Fantasy value is measured against a single season&apos;s player pool. Pick a season to
            see it.
          </p>
        </>
      ),
      gameLog: { rows },
    };
  }
  const range = rangeForSpan({ span });
  const [lines, league, profile] = await Promise.all([
    getFantasyPool({ range, season: selection }),
    getActiveLeague(),
    getProfile(),
  ]);
  const formula =
    ENABLED_METHODS.find((method) => method.key === profile?.preferredFormula)?.key ?? null;
  const seed = buildLeagueSeed({ league, preferredFormula: formula, presentKeys: new Set() });
  const { config, methodWeights } = configFromSeed({ seed });
  const fantasy = buildPlayerFantasyProfile({
    lines,
    playerId,
    config,
    methodWeights,
    range,
    logs,
    windowGames,
  });
  if (fantasy === null) {
    return {
      card: null,
      content: (
        <>
          <PlayerStatFilters modes={[]} />
          <p className={styles.empty}>
            No fantasy value for this timeframe: the player has no appearances in it.
          </p>
        </>
      ),
      gameLog: { rows },
    };
  }
  const stats = fantasy.readouts.map((readout): SeasonAverageStat => ({
    key: readout.key,
    label: readout.label,
    value: `${readout.key !== "points" && readout.value > 0 ? "+" : ""}${readout.value.toFixed(1)}`,
    rank: readout.rank,
    rankTone: "leader",
    eligibleCount: readout.of,
  }));
  return {
    card: stats.length > 0 && (
      <SeasonStatCard
        season={`${seasonLabel} · ${windowLabel}`}
        stats={stats}
        title="Fantasy value"
        poolNoun="valued players"
      />
    ),
    content: (
      <>
        <PlayerStatFilters modes={[]} />
        <PlayerFantasyChart breakdown={fantasy.breakdown} trend={fantasy.trend} />
        <FantasyValueLegend poolSize={fantasy.poolSize} windowLabel={windowLabel} basis="perGame" />
      </>
    ),
    gameLog: {
      view: "fantasy",
      categories: fantasy.breakdown.map(({ key, label }) => ({ key, label })),
      rows: rows.map((row, index) => ({ ...row, fantasy: fantasy.games[index] ?? null })),
    },
  };
};

const VIEW_LOADERS: Record<PlayerView, (context: ViewContext) => Promise<PlayerViewResult>> = {
  regular: loadRegularView,
  advanced: loadAdvancedView,
  fantasy: loadFantasyView,
};

// Select once: only the active view loads data and owns its card, charts,
// empty states, and game-log columns. The route remains the shared profile shell.
export const loadPlayerView = (args: PlayerViewArgs): Promise<PlayerViewResult> => {
  const windowGames = gamesForSpan({ span: args.span });
  return VIEW_LOADERS[args.view]({
    ...args,
    isCareer: args.selection === CAREER,
    windowGames,
    windowLabel: spanLabel({ span: args.span }),
    windowLogs: windowGames === null ? args.logs : args.logs.slice(-windowGames),
    rows: args.logs.map((log, index) => ({
      ...log,
      gameNumber: index + 1,
      gameDate: log.gameDate.toISOString(),
    })),
  });
};

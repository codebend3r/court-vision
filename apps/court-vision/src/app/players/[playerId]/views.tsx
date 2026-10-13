import type { ReactNode } from "react";
import type { PlayerGameLog } from "@generated/prisma/client";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import { PlayerAdvancedChart } from "@/components/PlayerAdvancedChart/PlayerAdvancedChart";
import { PlayerFantasyChart } from "@/components/PlayerFantasyChart/PlayerFantasyChart";
import type { GameLogRow } from "@/components/PlayerGameLogTable/gameLogColumns";
import type { PlayerGameLogTableProps } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { SeasonStatCard, type SeasonStat } from "@/components/SeasonStatCard/SeasonStatCard";
import { getProfile } from "@/lib/auth/session";
import { SEASON_TYPE } from "@/lib/stats/season";
import { getActiveLeague } from "@/lib/leagues/queries";
import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import { averageAdvancedLogs } from "@/lib/players/searchAdvanced";
import { gamesForRange } from "@/lib/players/searchParams";
import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonAverageStat,
  type SeasonStatTotals,
} from "@/lib/players/seasonAverages";
import { formatSigned } from "@vision/core/util/format";
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
import { toWindowLog } from "@/lib/valuation/trendLogs";
import { buildPlayerFantasyProfile, FANTASY_METHODS } from "@vision/sport-basketball/engine";
import { buildLeagueSeed, configFromSeed } from "@/lib/leagues/fantasyDefaults";

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
  rows: Array<GameLogRow & Pick<PlayerGameLog, "gameId">>;
};

type PlayerViewResult = {
  card: ReactNode;
  content: ReactNode;
  gameLog: PlayerGameLogTableProps;
};

// A leaderboard line as card readouts: a career line has no leaderboard, so
// its stats carry no rank.
const toSeasonStat = (stat: SeasonAverageStat): SeasonStat => ({
  key: stat.key,
  label: stat.label,
  value: stat.value,
  rank:
    stat.rank === null
      ? undefined
      : { position: stat.rank, tone: stat.rankTone, eligibleCount: stat.eligibleCount },
});

// The fantasy view with nothing to value: no card, no charts, the box-score
// log, and a line on why.
const fantasyEmptyView = ({
  message,
  rows,
}: {
  message: string;
  rows: ViewContext["rows"];
}): PlayerViewResult => ({
  card: null,
  content: (
    <>
      <PlayerStatFilters modes={[]} />
      <p className={styles.empty}>{message}</p>
    </>
  ),
  gameLog: { view: "regular", rows },
});

const loadRegularView = async (context: ViewContext): Promise<PlayerViewResult> => {
  const { playerId, selection, isCareer, seasonRows, seasonLabel, windowLogs, mode, rows } =
    context;
  const totals = isCareer ? aggregateCareerTotals({ rows: seasonRows, playerId }) : null;
  const line = isCareer
    ? totals === null
      ? []
      : buildCareerAverageLine({ totals })
    : (buildSeasonAverageLine({
        rows: await getSeasonStatsPool({ season: selection, seasonType: SEASON_TYPE }),
        playerId,
      }) ?? []);
  const stats = line.map(toSeasonStat);
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
    gameLog: { view: "regular", rows },
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
    (meta): SeasonStat => ({
      key: meta.key,
      label: meta.label,
      value: formatAdvancedStat({ key: meta.key, value: averages[meta.key] }),
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
    return fantasyEmptyView({
      message:
        "Fantasy value is measured against a single season's player pool. Pick a season to see it.",
      rows,
    });
  }
  const range = rangeForSpan({ span });
  const [lines, league, profile] = await Promise.all([
    getFantasyPool({ range, season: selection }),
    getActiveLeague(),
    getProfile(),
  ]);
  const formula =
    FANTASY_METHODS.find((method) => method.key === profile?.preferredFormula)?.key ?? null;
  const seed = buildLeagueSeed({ league, preferredFormula: formula, presentKeys: new Set() });
  const { config, methodWeights } = configFromSeed({ seed });
  const fantasy = buildPlayerFantasyProfile({
    lines,
    playerId,
    config,
    methodWeights,
    poolWindowGames: gamesForRange({ range }),
    logs: logs.map((log) => ({
      ...toWindowLog({ row: log }),
      gameDate: log.gameDate,
      gameId: log.gameId,
      matchup: log.matchup,
      winLoss: log.winLoss,
    })),
    windowGames,
  });
  if (fantasy === null) {
    return fantasyEmptyView({
      message: "No fantasy value for this timeframe: the player has no appearances in it.",
      rows,
    });
  }
  // Points are a total, not a value over average, so they print unsigned.
  const stats = fantasy.readouts.map((readout): SeasonStat => ({
    key: readout.key,
    label: readout.label,
    value:
      readout.key === "points"
        ? readout.value.toFixed(1)
        : formatSigned({ value: readout.value, digits: 1 }),
    rank: { position: readout.rank, tone: "leader", eligibleCount: readout.of },
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

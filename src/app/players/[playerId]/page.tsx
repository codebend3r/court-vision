import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { FantasyValueLegend } from "@/components/FantasyValueLegend/FantasyValueLegend";
import { PageHeader } from "@/components/PageHeader/PageHeader";
import { PlayerAdvancedChart } from "@/components/PlayerAdvancedChart/PlayerAdvancedChart";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerFantasyChart } from "@/components/PlayerFantasyChart/PlayerFantasyChart";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerStatChart } from "@/components/PlayerStatChart/PlayerStatChart";
import { PlayerStatFilters } from "@/components/PlayerStatFilters/PlayerStatFilters";
import { PlayerViewTabs } from "@/components/PlayerViewTabs/PlayerViewTabs";
import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
import { SeasonStatCard } from "@/components/SeasonStatCard/SeasonStatCard";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { getProfile, getUser } from "@/lib/auth/session";
import { SEASON_LABEL, SEASON_TYPE } from "@/lib/balldontlie/constants";
import { buildLeagueSeed } from "@/lib/leagues/fantasyDefaults";
import { getActiveLeague } from "@/lib/leagues/queries";
import { ADVANCED_STAT_META, formatAdvancedStat } from "@/lib/players/advancedStatMeta";
import {
  formatBirthDate,
  formatDraft,
  formatExperience,
  formatHeight,
  formatWeight,
} from "@/lib/players/format";
import { averageAdvancedLogs } from "@/lib/players/searchAdvanced";
import {
  aggregateCareerTotals,
  buildCareerAverageLine,
  buildSeasonAverageLine,
  type SeasonAverageStat,
} from "@/lib/players/seasonAverages";
import { getSeasonStatsPool } from "@/lib/players/seasonPool";
import { prisma } from "@/lib/prisma";
import {
  ADVANCED_MODES,
  buildAdvancedSeries,
  pickAdvancedMetrics,
  toAdvancedMode,
  type AdvancedPoint,
} from "@/lib/stats/advancedSeries";
import { buildStatSeries } from "@/lib/stats/cumulative";
import {
  CAREER,
  gamesForSpan,
  loadStatFilters,
  rangeForSpan,
  resolveSeasonSelection,
  spanLabel,
  type PlayerView,
} from "@/lib/stats/searchParams";
import { getFantasyPool } from "@/lib/valuation/loader";
import {
  buildPlayerFantasyProfile,
  configFromSeed,
  type PlayerFantasyProfile,
} from "@/lib/valuation/playerValue";
import { ENABLED_METHODS } from "@/lib/valuation/registry";

import styles from "@/app/players/[playerId]/page.module.scss";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

// Method scores print like the Fantasy Value table: signed, except PL Linear,
// which is a points total rather than a distance from average.
const formatMethodValue = ({ key, value }: { key: string; value: number }): string =>
  key !== "points" && value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { playerId } = await params;
  if (!/^\d+$/.test(playerId)) {
    notFound();
  }
  const numericId = Number.parseInt(playerId, 10);
  if (!Number.isSafeInteger(numericId) || numericId < 1 || numericId > MAX_INT4) {
    notFound();
  }
  const isSignedIn = !!(await getUser());
  const player = await prisma.player.findUnique({ where: { id: numericId } });
  if (player === null) {
    notFound();
  }

  const {
    mode,
    span,
    season: requestedSeason,
    view,
  } = await loadStatFilters(searchParams ?? Promise.resolve({}));

  // The player's own season rows drive the dropdown options, the default
  // selection (their most recent season), and the career totals.
  const playerSeasonRows = await prisma.playerSeasonStats.findMany({
    where: { playerId: numericId, seasonType: SEASON_TYPE },
    orderBy: { season: "desc" },
  });
  const playerSeasons = [...new Set(playerSeasonRows.map((row) => row.season))];
  const selection = resolveSeasonSelection({ requested: requestedSeason, playerSeasons });
  const isCareer = selection === CAREER;

  // Every downstream view (games count, chart, log table) is scoped to the
  // selection at the query level; career keeps the full history.
  const logs = await prisma.playerGameLog.findMany({
    where: isCareer ? { playerId: numericId } : { playerId: numericId, season: selection },
    orderBy: { gameDate: "asc" },
  });
  // Games played counts appearances only, not DNPs (0-minute roster games).
  const gamesPlayed = logs.filter((log) => log.minutes > 0).length;

  let statLine: SeasonAverageStat[] = [];
  if (isCareer) {
    const careerTotals = aggregateCareerTotals({ rows: playerSeasonRows, playerId: numericId });
    statLine = careerTotals ? buildCareerAverageLine({ totals: careerTotals }) : [];
  } else {
    // The whole qualified pool is needed to place this player's averages on the
    // league leaderboards, not just their own row.
    const seasonRows = await getSeasonStatsPool({
      season: selection,
      seasonType: SEASON_TYPE,
    });
    statLine = buildSeasonAverageLine({ rows: seasonRows, playerId: numericId }) ?? [];
  }

  const newestSeason = playerSeasons[0] ?? null;
  const oldestSeason = playerSeasons[playerSeasons.length - 1] ?? null;
  // The card labels the career with its actual data span (the backfill only
  // reaches 2020-21), so a veteran's card doesn't imply a full career.
  const careerSpanLabel =
    !!oldestSeason && oldestSeason !== newestSeason
      ? `${oldestSeason} to ${newestSeason ?? ""}`
      : (newestSeason ?? SEASON_LABEL);
  const seasonLabel = isCareer ? careerSpanLabel : selection;
  const windowLabel = spanLabel({ span });

  const windowSize = gamesForSpan({ span });
  const windowLogs = windowSize === null ? logs : logs.slice(-windowSize);
  const series = view === "regular" ? buildStatSeries({ logs: windowLogs, mode }) : [];

  // Advanced: the box-score window decides which games count; the advanced
  // rows attach by gameId, and the card averages exactly the plotted window.
  const advancedMode = toAdvancedMode({ mode });
  let advancedSeries: AdvancedPoint[] = [];
  let advancedLine: SeasonAverageStat[] = [];
  // Every game's advanced row by gameId, for the game log; the chart and card
  // only read the window's.
  let advancedByGame = new Map<string, ReturnType<typeof pickAdvancedMetrics>>();
  if (view === "advanced" && logs.length > 0) {
    const advancedLogs = await prisma.playerAdvancedGameLog.findMany({
      where: isCareer ? { playerId: numericId } : { playerId: numericId, season: selection },
      orderBy: { gameDate: "asc" },
    });
    advancedByGame = new Map(
      advancedLogs.map((row) => [row.gameId, pickAdvancedMetrics({ log: row })]),
    );
    const windowGameIds = new Set(windowLogs.map((log) => log.gameId));
    const windowAdvanced = advancedLogs.filter((row) => windowGameIds.has(row.gameId));
    const averages = averageAdvancedLogs({ logs: windowAdvanced });
    advancedLine = ADVANCED_STAT_META.filter((meta) => averages[meta.key] !== null).map(
      (meta): SeasonAverageStat => ({
        key: meta.key,
        label: meta.label,
        value: formatAdvancedStat({ key: meta.key, value: averages[meta.key] }),
        rank: null,
        rankTone: "leader",
        eligibleCount: 0,
      }),
    );
    advancedSeries = buildAdvancedSeries({
      logs: windowLogs,
      advancedLogs: windowAdvanced,
      mode: advancedMode,
    });
  }

  // Fantasy: the same cached pool, league seed, and engine as the Fantasy
  // Value tab, so this card agrees with that table to the decimal. A pool is
  // one season's players, so career has nothing to measure against.
  let fantasy: PlayerFantasyProfile | null = null;
  let fantasyLine: SeasonAverageStat[] = [];
  if (view === "fantasy" && !isCareer && logs.length > 0) {
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
    fantasy = buildPlayerFantasyProfile({
      lines,
      playerId: numericId,
      config,
      methodWeights,
      range,
      logs,
      windowGames: windowSize,
    });
    fantasyLine =
      fantasy?.readouts.map((readout): SeasonAverageStat => ({
        key: readout.key,
        label: readout.label,
        value: formatMethodValue({ key: readout.key, value: readout.value }),
        rank: readout.rank,
        rankTone: "leader",
        eligibleCount: readout.of,
      })) ?? [];
  }

  const isPresentFact = (fact: {
    label: string;
    value: string | null;
  }): fact is { label: string; value: string } => !!fact.value;
  const facts = [
    { label: "Height", value: formatHeight({ heightInches: player.heightInches }) },
    { label: "Weight", value: formatWeight({ weightLbs: player.weightLbs }) },
    { label: "Born", value: formatBirthDate({ birthDate: player.birthDate }) },
    { label: "Country", value: player.country },
    { label: "College", value: player.college },
    {
      label: "Draft",
      value: formatDraft({
        draftYear: player.draftYear,
        draftRound: player.draftRound,
        draftNumber: player.draftNumber,
      }),
    },
    {
      label: "Experience",
      value: formatExperience({
        draftYear: player.draftYear,
        seasonStartYear: Number.parseInt(SEASON_LABEL, 10),
      }),
    },
  ].filter(isPresentFact);

  // The game log follows the view: the box score, each game's advanced
  // metrics, or each game's fantasy value. Fantasy keeps the box score when
  // there is nothing to value (career, or no line in the window's pool), since
  // a log of dashes says less than the games themselves.
  const logView: PlayerView = view === "fantasy" && fantasy === null ? "regular" : view;

  // An empty single-season view blames the season (the dropdown can recover);
  // career or a player with no data at all blames the player.
  const emptySubject = isCareer || playerSeasons.length === 0 ? "player" : "season";

  const headerCard =
    view === "advanced"
      ? advancedLine.length > 0 && (
          <SeasonStatCard
            season={`${seasonLabel} · ${windowLabel}`}
            stats={advancedLine}
            title="Advanced averages"
          />
        )
      : view === "fantasy"
        ? fantasyLine.length > 0 && (
            <SeasonStatCard
              season={`${seasonLabel} · ${windowLabel}`}
              stats={fantasyLine}
              title="Fantasy value"
              rankScope="in NBA"
              poolNoun="valued players"
            />
          )
        : statLine.length > 0 && (
            <SeasonStatCard
              season={seasonLabel}
              stats={statLine}
              title={isCareer ? "Career averages" : "Season averages"}
            />
          );

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow="Research · Player"
        title={player.fullName}
        description="Season averages against the qualified pool, the rolling shape of form, and every game behind it."
        actions={
          <StarButton
            playerId={player.id}
            fullName={player.fullName}
            isSignedIn={isSignedIn}
            size="md"
          />
        }
      />
      <PlayerViewTabs active={view} />
      <header className={styles.header}>
        <PlayerAvatar
          fullName={player.fullName}
          nbaPersonId={player.nbaPersonId}
          size="lg"
          teamAbbr={player.teamAbbr}
        />
        <span className={styles.headerText}>
          <p className={styles.meta}>
            {!!player.teamAbbr && <TeamChip team={player.teamAbbr} size="sm" />}
            {!!player.position && <span>{player.position}</span>}
            {!!player.jerseyNumber && <span>#{player.jerseyNumber}</span>}
            {playerSeasons.length > 0 ? (
              <>
                <SeasonSelect seasons={playerSeasons} value={selection} />
                <span>{gamesPlayed} games</span>
              </>
            ) : (
              <span>
                {isCareer ? "Career" : selection} · {gamesPlayed} games
              </span>
            )}
          </p>
          {facts.length > 0 && (
            <dl className={styles.facts}>
              {facts.map(({ label, value }) => (
                <div key={label} className={styles.fact}>
                  <dt className={styles.factLabel}>{label}</dt>
                  <dd className={styles.factValue}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </span>
        {!!headerCard && <div className={styles.headerCard}>{headerCard}</div>}
      </header>

      {logs.length === 0 ? (
        <p className={styles.empty}>No game logs for this {emptySubject} yet.</p>
      ) : (
        <section className={styles.view} aria-label="Stat view">
          {view === "regular" && (
            <>
              <PlayerStatFilters />
              <PlayerStatChart series={series} mode={mode} />
            </>
          )}
          {view === "advanced" && (
            <>
              <PlayerStatFilters modes={ADVANCED_MODES} />
              {advancedLine.length === 0 ? (
                <p className={styles.empty}>No advanced stats recorded for this timeframe yet.</p>
              ) : (
                <PlayerAdvancedChart series={advancedSeries} mode={advancedMode} />
              )}
              <AdvancedStatsLegend />
            </>
          )}
          {view === "fantasy" && (
            <>
              <PlayerStatFilters modes={[]} />
              {isCareer ? (
                <p className={styles.empty}>
                  Fantasy value is measured against a single season&apos;s player pool. Pick a
                  season to see it.
                </p>
              ) : fantasy === null ? (
                <p className={styles.empty}>
                  No fantasy value for this timeframe: the player has no appearances in it.
                </p>
              ) : (
                <>
                  <PlayerFantasyChart breakdown={fantasy.breakdown} trend={fantasy.trend} />
                  <FantasyValueLegend
                    poolSize={fantasy.poolSize}
                    windowLabel={windowLabel}
                    basis="perGame"
                  />
                </>
              )}
            </>
          )}
        </section>
      )}

      {logs.length > 0 && (
        <PlayerGameLogTable
          view={logView}
          categories={fantasy?.breakdown.map(({ key, label }) => ({ key, label }))}
          rows={logs.map((log, index) => ({
            ...log,
            gameNumber: index + 1,
            gameDate: log.gameDate.toISOString(),
            advanced: advancedByGame.get(log.gameId) ?? null,
            fantasy: fantasy?.games[index] ?? null,
          }))}
        />
      )}
    </main>
  );
}

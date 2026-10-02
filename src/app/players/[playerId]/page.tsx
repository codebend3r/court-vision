import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";

import { PageHeader } from "@/components/PageHeader/PageHeader";
import { PlayerAvatar } from "@/components/PlayerAvatar/PlayerAvatar";
import { PlayerGameLogTable } from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { PlayerViewTabs } from "@/components/PlayerViewTabs/PlayerViewTabs";
import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";
import { StarButton } from "@/components/StarButton/StarButton";
import { TeamChip } from "@/components/TeamChip/TeamChip";
import { getUser } from "@/lib/auth/session";
import { SEASON_LABEL, SEASON_TYPE } from "@/lib/balldontlie/constants";
import {
  formatBirthDate,
  formatDraft,
  formatExperience,
  formatHeight,
  formatWeight,
} from "@/lib/players/format";
import { prisma } from "@/lib/prisma";
import { CAREER, loadStatFilters, resolveSeasonSelection } from "@/lib/stats/searchParams";
import { loadPlayerView } from "@/app/players/[playerId]/views";

import styles from "@/app/players/[playerId]/page.module.scss";

export const dynamic = "force-dynamic";

// Player.id is a Postgres INT4; anything outside its range would make Prisma
// throw (a 500) instead of rendering a 404.
const MAX_INT4 = 2147483647;

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
  // None of these reads depends on another, so they share one round trip
  // instead of four. The player's own season rows drive the dropdown options,
  // the default selection (their most recent season), and the career totals.
  const [user, player, filters, playerSeasonRows] = await Promise.all([
    getUser(),
    prisma.player.findUnique({ where: { id: numericId } }),
    loadStatFilters(searchParams ?? Promise.resolve({})),
    prisma.playerSeasonStats.findMany({
      where: { playerId: numericId, seasonType: SEASON_TYPE },
      orderBy: { season: "desc" },
    }),
  ]);
  if (player === null) {
    notFound();
  }
  const isSignedIn = !!user;
  const { mode, span, season: requestedSeason, view } = filters;
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

  const newestSeason = playerSeasons[0] ?? null;
  const oldestSeason = playerSeasons[playerSeasons.length - 1] ?? null;
  // The card labels the career with its actual data span (the backfill only
  // reaches 2020-21), so a veteran's card doesn't imply a full career.
  const careerSpanLabel =
    !!oldestSeason && oldestSeason !== newestSeason
      ? `${oldestSeason} to ${newestSeason ?? ""}`
      : (newestSeason ?? SEASON_LABEL);
  const seasonLabel = isCareer ? careerSpanLabel : selection;
  const { card, content, gameLog } = await loadPlayerView({
    view,
    playerId: numericId,
    selection,
    seasonLabel,
    seasonRows: playerSeasonRows,
    logs,
    mode,
    span,
  });

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

  // An empty single-season view blames the season (the dropdown can recover);
  // career or a player with no data at all blames the player.
  const emptySubject = isCareer || playerSeasons.length === 0 ? "player" : "season";

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
        {!!card && <div className={styles.headerCard}>{card}</div>}
      </header>

      {logs.length === 0 ? (
        <p className={styles.empty}>No game logs for this {emptySubject} yet.</p>
      ) : (
        <section className={styles.view} aria-label="Stat view">
          {content}
        </section>
      )}

      {logs.length > 0 && <PlayerGameLogTable {...gameLog} />}
    </main>
  );
}

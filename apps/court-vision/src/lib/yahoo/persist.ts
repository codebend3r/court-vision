import { type League, type Prisma } from "@generated/prisma/client";
import { uniqueSlug } from "@vision/core/league/slug";
import { teamNameToSlug } from "@vision/core/roster/slug";
import { sequentially } from "@vision/core/util/sequentially";

import { type LeagueSyncVia } from "@/lib/leagues/types";
import { YAHOO_PROVIDER } from "@/lib/yahoo/constants";
import { type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import { type ImportedLeague, type ImportedTeam, type YahooPlayerRef } from "@/lib/yahoo/types";

export type PersistArgs = {
  tx: Prisma.TransactionClient;
  profileId: string;
  league: ImportedLeague;
  resolved: ResolvedPlayers;
  waiverRefs: readonly YahooPlayerRef[];
};

type SluggedTeam = { team: ImportedTeam; slug: string };
type WrittenTeam = { teamId: string; team: ImportedTeam };

// Settings a sync refreshes. The name and slug are the user's once imported.
type ToLeagueSettingsProps = { league: ImportedLeague };

const toLeagueSettings = ({ league }: ToLeagueSettingsProps) => ({
  externalUrl: league.externalUrl,
  scoringType: league.scoring.scoringType,
  scoringConfig: { ...league.scoring.scoringConfig },
  unsupportedCategories: league.scoring.unsupportedCategories,
  teamCount: league.teamCount,
  rosterSlots: league.rosterSlots,
  statCategories: league.statCategories.map((category) => ({ ...category })),
});

// A slug per team: a kept team keeps its own (`kept` maps Yahoo key to slug),
// and any other gets one unique against the kept slugs and against each other.
type WithSlugsProps = {
  teams: readonly ImportedTeam[];
  kept: ReadonlyMap<string, string>;
};

const withSlugs = ({ teams, kept }: WithSlugsProps): SluggedTeam[] =>
  teams.reduce<SluggedTeam[]>(
    (slugged, team) => [
      ...slugged,
      {
        team,
        slug:
          kept.get(team.externalKey) ??
          uniqueSlug({
            base: teamNameToSlug({ name: team.name }),
            taken: [...kept.values(), ...slugged.map(({ slug }) => slug)],
          }),
      },
    ],
    [],
  );

// A matched player is stored by `playerId`; an unmatched one keeps its Yahoo
// id and name so the slot still shows who is in it. Both carry Yahoo's injury
// status. `position` is the slot's index in the team, as in the Team Builder.
type ToSlotRowsProps = WrittenTeam & { profileId: string; resolved: ResolvedPlayers };

const toSlotRows = ({ teamId, team, profileId, resolved }: ToSlotRowsProps) =>
  team.slots.map(({ slotType, player }, position) => {
    const playerId = player ? (resolved.byYahooId.get(player.yahooPlayerId) ?? null) : null;
    const unmatched = player && playerId === null ? player : null;
    return {
      teamId,
      profileId,
      slotType,
      position,
      playerId,
      externalPlayerKey: unmatched?.yahooPlayerId ?? null,
      externalPlayerName: unmatched?.fullName ?? null,
      injuryStatus: player?.status ?? null,
      displayPosition: player?.displayPosition ?? null,
    };
  });

type WriteSlotsProps = Pick<PersistArgs, "tx" | "profileId" | "resolved"> & {
  teams: readonly WrittenTeam[];
};

const writeSlots = async ({ tx, profileId, resolved, teams }: WriteSlotsProps): Promise<void> => {
  const data = teams.flatMap(({ teamId, team }) =>
    toSlotRows({ teamId, team, profileId, resolved }),
  );
  if (!data.length) return;
  await tx.leagueTeamSlot.createMany({ data });
};

// Only waiver players Court Vision knows are stored: the table keys on `playerId`.
type WriteWaiversProps = Pick<PersistArgs, "tx" | "profileId" | "resolved" | "waiverRefs"> & {
  leagueId: string;
};

const writeWaivers = async ({
  tx,
  profileId,
  resolved,
  waiverRefs,
  leagueId,
}: WriteWaiversProps): Promise<void> => {
  const data = waiverRefs.flatMap((ref) => {
    const playerId = resolved.byYahooId.get(ref.yahooPlayerId);
    return playerId === undefined
      ? []
      : [
          {
            leagueId,
            playerId,
            profileId,
            injuryStatus: ref.status,
            displayPosition: ref.displayPosition,
          },
        ];
  });
  if (!data.length) return;
  await tx.leagueWaiverPlayer.createMany({ data, skipDuplicates: true });
};

// The current week's matchups, each side pointed at the team row its Yahoo key
// names. A matchup naming a team the league doesn't have is skipped.
type WriteMatchupsProps = {
  tx: Prisma.TransactionClient;
  profileId: string;
  leagueId: string;
  league: ImportedLeague;
  teams: readonly WrittenTeam[];
};

const writeMatchups = async ({
  tx,
  profileId,
  leagueId,
  league,
  teams,
}: WriteMatchupsProps): Promise<void> => {
  const idByKey = new Map(teams.map(({ teamId, team }) => [team.externalKey, teamId]));
  const syncedAt = new Date();
  const data = (league.matchups ?? []).flatMap(({ week, weekStart, weekEnd, status, sides }) => {
    const [a, b] = sides;
    const teamAId = idByKey.get(a.teamKey);
    const teamBId = b === undefined ? null : idByKey.get(b.teamKey);
    return teamAId === undefined || teamBId === undefined
      ? []
      : [
          {
            leagueId,
            profileId,
            week,
            weekStart,
            weekEnd,
            status,
            teamAId,
            teamBId,
            statsA: a.stats,
            statsB: b?.stats ?? {},
            syncedAt,
          },
        ];
  });
  if (!data.length) return;
  await tx.leagueMatchup.createMany({ data });
};

/**
 * Writes a newly imported league, its teams, rosters and waiver list, makes it
 * the active league and points `myTeamId` at the user's team. `syncVia` records
 * which path keeps it in sync from here on. Run it inside the caller's
 * transaction; the league cap is the caller's to check.
 */
type CreateImportedLeagueProps = PersistArgs & {
  myTeamExternalKey: string;
  syncVia: LeagueSyncVia;
};

export const createImportedLeague = async ({
  tx,
  profileId,
  league,
  resolved,
  waiverRefs,
  myTeamExternalKey,
  syncVia,
}: CreateImportedLeagueProps): Promise<League> => {
  // The database can't check that `myTeamId` names one of this league's own
  // teams, so this does, before anything is written.
  if (!league.teams.some(({ externalKey }) => externalKey === myTeamExternalKey)) {
    throw new Error(
      `createImportedLeague: team "${myTeamExternalKey}" is not in league ${league.externalKey}`,
    );
  }

  const existing = await tx.league.findMany({ where: { profileId }, select: { slug: true } });
  const created = await tx.league.create({
    data: {
      profileId,
      name: league.name,
      slug: uniqueSlug({
        base: teamNameToSlug({ name: league.name }),
        taken: existing.map(({ slug }) => slug),
      }),
      provider: YAHOO_PROVIDER,
      syncVia,
      externalKey: league.externalKey,
      ...toLeagueSettings({ league }),
      syncedAt: new Date(),
    },
  });

  const teams = await sequentially({
    items: withSlugs({ teams: league.teams, kept: new Map() }),
    run: async ({ item: { team, slug } }): Promise<WrittenTeam> => {
      const row = await tx.leagueTeam.create({
        data: {
          leagueId: created.id,
          profileId,
          name: team.name,
          slug,
          externalKey: team.externalKey,
          logoUrl: team.logoUrl,
          managerName: team.managerName,
        },
      });
      return { teamId: row.id, team };
    },
  });
  await writeSlots({ tx, profileId, resolved, teams });
  await writeWaivers({ tx, profileId, resolved, waiverRefs, leagueId: created.id });
  await writeMatchups({ tx, profileId, leagueId: created.id, league, teams });

  const myTeam = teams.find(({ team }) => team.externalKey === myTeamExternalKey);
  const withMyTeam = await tx.league.update({
    where: { id: created.id },
    data: { myTeamId: myTeam?.teamId ?? null },
  });
  await tx.profile.update({ where: { id: profileId }, data: { activeLeagueId: created.id } });
  return withMyTeam;
};

/**
 * Re-syncs an imported league in place: refreshes its settings, upserts its
 * teams by Yahoo key (keeping each slug, so links and `myTeamId` survive),
 * deletes teams Yahoo no longer has, and rewrites every roster, the waiver
 * list and the current week's matchups. The league's name and slug are left alone.
 */
type SyncImportedLeagueProps = PersistArgs & { leagueId: string; syncStartedAt: Date };

export const syncImportedLeague = async ({
  tx,
  profileId,
  league,
  resolved,
  waiverRefs,
  leagueId,
  syncStartedAt,
}: SyncImportedLeagueProps): Promise<League> => {
  // First, so a league that isn't this owner's import of this Yahoo league
  // fails (P2025) before anything else is touched.
  const { statCategories, ...settings } = toLeagueSettings({ league });
  await tx.league.update({
    where: {
      id: leagueId,
      profileId,
      provider: YAHOO_PROVIDER,
      externalKey: league.externalKey,
      syncStartedAt,
      syncLeaseUntil: { gt: new Date() },
    },
    data: {
      ...settings,
      // Retained totals must keep the category definitions they were read with.
      ...(league.matchups !== null && { statCategories }),
      syncedAt: new Date(),
      syncError: null,
    },
  });

  const existing = await tx.leagueTeam.findMany({
    where: { leagueId, profileId },
    select: { id: true, slug: true, externalKey: true },
  });
  const incomingKeys = new Set(league.teams.map(({ externalKey }) => externalKey));
  const kept = new Map(
    existing.flatMap(({ externalKey, slug }): [string, string][] =>
      externalKey !== null && incomingKeys.has(externalKey) ? [[externalKey, slug]] : [],
    ),
  );
  const vanishedIds = existing
    .filter(({ externalKey }) => externalKey === null || !kept.has(externalKey))
    .map(({ id }) => id);
  // Deleted before the upserts, so a new team may reuse a vanished team's slug.
  if (vanishedIds.length) {
    await tx.leagueTeam.deleteMany({ where: { id: { in: vanishedIds }, leagueId, profileId } });
  }

  const teams = await sequentially({
    items: withSlugs({ teams: league.teams, kept }),
    run: async ({ item: { team, slug } }): Promise<WrittenTeam> => {
      const row = await tx.leagueTeam.upsert({
        where: { leagueId_externalKey: { leagueId, externalKey: team.externalKey } },
        create: {
          leagueId,
          profileId,
          name: team.name,
          slug,
          externalKey: team.externalKey,
          logoUrl: team.logoUrl,
          managerName: team.managerName,
        },
        // Yahoo hides manager names from anonymous reads, so a null here means
        // hidden, not gone: keep whatever name the extension last supplied.
        update: {
          name: team.name,
          logoUrl: team.logoUrl,
          ...(team.managerName !== null && { managerName: team.managerName }),
        },
      });
      return { teamId: row.id, team };
    },
  });

  await tx.leagueTeamSlot.deleteMany({ where: { team: { leagueId }, profileId } });
  await writeSlots({ tx, profileId, resolved, teams });

  await tx.leagueWaiverPlayer.deleteMany({ where: { leagueId, profileId } });
  await writeWaivers({ tx, profileId, resolved, waiverRefs, leagueId });

  // An unavailable scoreboard preserves its own timestamp; a successful empty
  // read clears last week's rows just like a successful populated read.
  if (league.matchups !== null) {
    await tx.leagueMatchup.deleteMany({ where: { leagueId, profileId } });
    await writeMatchups({ tx, profileId, leagueId, league, teams });
  }

  // Read back rather than returning the update above: deleting a vanished team
  // may since have cleared `myTeamId` (SetNull).
  return tx.league.findUniqueOrThrow({ where: { id: leagueId } });
};

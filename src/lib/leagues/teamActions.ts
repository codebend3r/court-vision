"use server";

import { type Prisma } from "@generated/prisma/client";

import { getProfile } from "@/lib/auth/session";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { type FantasyTeam, type RosterSlot } from "@/lib/fantasyTeams/types";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { uniqueSlug } from "@/lib/leagues/slug";
import { TEAM_INCLUDE, toFantasyTeam } from "@/lib/leagues/teamQueries";
import { isFantasyTeamPlayer, isRosterSlotType, slotsToRows } from "@/lib/leagues/teams";
import { type LeagueTeamActionResult, type LegacyTeamsImportResult } from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

const isValidSlots = ({ slots }: { slots: readonly RosterSlot[] }): boolean =>
  slots.length >= 1 &&
  slots.length <= 60 &&
  slots.every(
    (slot) =>
      isRosterSlotType(slot.type) && (slot.player === null || isFantasyTeamPlayer(slot.player)),
  );

// Resolves the LeagueTeam row to write slots against: creates a fresh row
// with a collision-proof slug when teamId is null, otherwise renames the
// existing row scoped by ownership so a forged teamId updates 0 rows.
const ensureTeamRow = async ({
  tx,
  leagueId,
  teamId,
  profileId,
  name,
}: {
  tx: Prisma.TransactionClient;
  leagueId: string;
  teamId: string | null;
  profileId: string;
  name: string;
}): Promise<{ status: "ok"; teamId: string } | { status: "invalid" }> => {
  if (teamId === null) {
    const existing = await tx.leagueTeam.findMany({
      where: { leagueId },
      select: { slug: true },
    });
    const created = await tx.leagueTeam.create({
      data: {
        leagueId,
        profileId,
        name,
        slug: uniqueSlug({
          base: teamNameToSlug(name),
          taken: existing.map((row) => row.slug),
        }),
      },
    });
    return { status: "ok", teamId: created.id };
  }
  const updated = await tx.leagueTeam.updateMany({
    where: { id: teamId, leagueId, profileId },
    data: { name },
  });
  return updated.count === 0 ? { status: "invalid" } : { status: "ok", teamId };
};

export const saveLeagueTeam = async ({
  leagueId,
  teamId,
  name,
  slots,
}: {
  leagueId: string;
  teamId: string | null;
  name: string;
  slots: readonly RosterSlot[];
}): Promise<LeagueTeamActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };

  const trimmed = name.trim();
  if (trimmed === "" || !isValidSlots({ slots })) return { status: "invalid" };

  // RLS-safe ownership check up front: a forged leagueId never sees a row.
  const league = await prisma.league.findFirst({
    where: { id: leagueId, profileId: profile.id },
    select: { id: true },
  });
  if (league === null) return { status: "invalid" };

  try {
    return await prisma.$transaction(async (tx) => {
      const teamRow = await ensureTeamRow({
        tx,
        leagueId,
        teamId,
        profileId: profile.id,
        name: trimmed,
      });
      if (teamRow.status === "invalid") return { status: "invalid" };

      await tx.leagueTeamSlot.deleteMany({ where: { teamId: teamRow.teamId } });
      const rows = slotsToRows({ slots });
      if (rows.length > 0) {
        await tx.leagueTeamSlot.createMany({
          data: rows.map((row) => ({
            teamId: teamRow.teamId,
            profileId: profile.id,
            slotType: row.slotType,
            position: row.position,
            playerId: row.playerId,
          })),
        });
      }

      const team = await tx.leagueTeam.findUnique({
        where: { id: teamRow.teamId },
        include: TEAM_INCLUDE,
      });
      if (team === null) return { status: "error" };
      return { status: "ok", team: toFantasyTeam({ team }) };
    });
  } catch {
    return { status: "error" };
  }
};

// Creates one LeagueTeam + its slots inside the given transaction, reusing
// the same create path as ensureTeamRow/saveLeagueTeam.
const createLegacyTeam = async ({
  tx,
  leagueId,
  profileId,
  team,
  slug,
}: {
  tx: Prisma.TransactionClient;
  leagueId: string;
  profileId: string;
  team: FantasyTeam;
  slug: string;
}): Promise<void> => {
  const created = await tx.leagueTeam.create({
    data: { leagueId, profileId, name: team.name, slug },
  });
  const rows = slotsToRows({ slots: team.slots });
  if (rows.length === 0) return;
  await tx.leagueTeamSlot.createMany({
    data: rows.map((row) => ({
      teamId: created.id,
      profileId,
      slotType: row.slotType,
      position: row.position,
      playerId: row.playerId,
    })),
  });
};

// Hard cap on a single import batch — a legacy localStorage payload is
// bounded by what a person could plausibly have built by hand in the old UI.
const MAX_LEGACY_IMPORT_TEAMS = 50;

const isValidLegacyTeam = ({ team }: { team: FantasyTeam }): boolean =>
  team.name.trim() !== "" && isValidSlots({ slots: team.slots });

// One-time import of the pre-league localStorage teams into the caller's
// default league. Only runs against an empty league — if teams already exist
// server-side, the legacy payload is stale and is skipped rather than merged.
export const importLegacyTeams = async ({
  teams,
}: {
  teams: readonly FantasyTeam[];
}): Promise<LegacyTeamsImportResult> => {
  if (teams.length > MAX_LEGACY_IMPORT_TEAMS) return { status: "error" };
  if (!teams.every((team) => isValidLegacyTeam({ team }))) return { status: "error" };

  try {
    const profile = await getProfile();
    if (profile === null) return { status: "unauthenticated" };

    // Pass the already-resolved profile through so ensureDefaultLeague
    // doesn't re-fetch the session a second time.
    const league = await ensureDefaultLeague({ profile });
    if (league === null) return { status: "unauthenticated" };

    const slugs = teams.reduce<string[]>(
      (taken, team) => [...taken, uniqueSlug({ base: teamNameToSlug(team.name.trim()), taken })],
      [],
    );

    return await prisma.$transaction(async (tx) => {
      // Re-checked inside the transaction (not just before it) so two
      // concurrent imports — a double-invoke or two tabs — can't both read
      // "empty" and both write; the slug unique constraint is the second
      // line of defense if this still races across transactions.
      const existingCount = await tx.leagueTeam.count({ where: { leagueId: league.id } });
      if (existingCount > 0) return { status: "skipped" };
      if (teams.length === 0) return { status: "ok" };

      await teams.reduce(
        (previous, team, index) =>
          previous.then(() =>
            createLegacyTeam({
              tx,
              leagueId: league.id,
              profileId: profile.id,
              team: { ...team, name: team.name.trim() },
              slug: slugs[index] ?? teamNameToSlug(team.name.trim()),
            }),
          ),
        Promise.resolve(),
      );
      return { status: "ok" };
    });
  } catch {
    return { status: "error" };
  }
};

export const deleteLeagueTeam = async ({
  teamId,
}: {
  teamId: string;
}): Promise<LeagueTeamActionResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    // Idempotent: deleting an already-gone or unowned team still reports
    // ok-deleted, since the end state the caller wants is "team is gone".
    await prisma.leagueTeam.deleteMany({ where: { id: teamId, profileId: profile.id } });
    return { status: "ok-deleted" };
  } catch {
    return { status: "error" };
  }
};

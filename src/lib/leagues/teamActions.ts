"use server";

import { type Prisma } from "@generated/prisma/client";

import { getProfile } from "@/lib/auth/session";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { type RosterSlot } from "@/lib/fantasyTeams/types";
import { uniqueSlug } from "@/lib/leagues/slug";
import { TEAM_INCLUDE, toFantasyTeam } from "@/lib/leagues/teamQueries";
import { isFantasyTeamPlayer, isRosterSlotType, slotsToRows } from "@/lib/leagues/teams";
import { type LeagueTeamActionResult } from "@/lib/leagues/types";
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

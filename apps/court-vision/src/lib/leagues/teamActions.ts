"use server";

import { type Prisma } from "@generated/prisma/client";

import {
  isActionArray,
  isActionId,
  isActionText,
  isOptionalActionId,
} from "@vision/core/util/argGuards";
import { isRecord } from "@vision/core/util/record";
import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { teamNameToSlug } from "@vision/core/roster/slug";
import { type FantasyTeam, type RosterSlot } from "@/lib/fantasyTeams/types";
import { ensureDefaultLeague } from "@/lib/leagues/queries";
import { uniqueSlug } from "@vision/core/league/slug";
import { TEAM_INCLUDE, toFantasyTeam } from "@/lib/leagues/teamQueries";
import { isRosterSlot, slotsToRows } from "@/lib/leagues/teams";
import {
  type LeagueTeamDeleteResult,
  type LeagueTeamSaveResult,
  type LegacyTeamsImportResult,
} from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

const isValidSlots = ({ slots }: { slots: readonly unknown[] }): boolean =>
  slots.length >= 1 && slots.length <= 60 && slots.every(isRosterSlot);

// Writes every given team's slots as LeagueTeamSlot rows, in roster order, in
// one statement. Each row carries the owner as well as the team, so RLS is a
// direct check.
const writeSlots = async ({
  tx,
  profileId,
  teams,
}: {
  tx: Prisma.TransactionClient;
  profileId: string;
  teams: readonly { teamId: string; slots: readonly RosterSlot[] }[];
}): Promise<void> => {
  const data = teams.flatMap(({ teamId, slots }) =>
    slotsToRows({ slots }).map((row) => ({ teamId, profileId, ...row })),
  );
  if (data.length === 0) return;
  await tx.leagueTeamSlot.createMany({ data });
};

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
          base: teamNameToSlug({ name }),
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
}): Promise<LeagueTeamSaveResult> => {
  // Runtime-check every argument that reaches a `where` clause before Prisma
  // sees it: the annotations above are erased, and an object here becomes a
  // Prisma filter rather than a value. `name.trim()` below also throws on a
  // non-string, which would escape as a 500 instead of a result union.
  if (
    !isActionId(leagueId) ||
    !isOptionalActionId(teamId) ||
    !isActionText(name) ||
    !isActionArray(slots)
  ) {
    return { status: "invalid" };
  }

  const trimmed = name.trim();
  if (trimmed === "" || !isValidSlots({ slots })) return { status: "invalid" };

  return withProfile<LeagueTeamSaveResult>({
    getProfile,
    run: async ({ profile }) => {
      // RLS-safe ownership check up front: a forged leagueId never sees a row.
      // Only a hand-built league's teams are editable; an imported league's
      // teams belong to its host and read as not found here.
      const league = await prisma.league.findFirst({
        where: { id: leagueId, profileId: profile.id, provider: "manual" },
        select: { id: true },
      });
      if (league === null) return { status: "invalid" };

      return prisma.$transaction(async (tx) => {
        const teamRow = await ensureTeamRow({
          tx,
          leagueId,
          teamId,
          profileId: profile.id,
          name: trimmed,
        });
        if (teamRow.status === "invalid") return { status: "invalid" };

        // Scoped by owner as well as team. Independent of the guard above: this
        // delete must never be able to widen past the caller's own rows, whatever
        // teamRow.teamId turns out to hold.
        await tx.leagueTeamSlot.deleteMany({
          where: { teamId: teamRow.teamId, profileId: profile.id },
        });
        await writeSlots({
          tx,
          profileId: profile.id,
          teams: [{ teamId: teamRow.teamId, slots }],
        });

        const team = await tx.leagueTeam.findUnique({
          where: { id: teamRow.teamId },
          include: TEAM_INCLUDE,
        });
        if (team === null) return { status: "error" };
        return {
          status: "ok",
          team: toFantasyTeam({ team, isMine: false, isImported: false }),
        };
      });
    },
  });
};

// Hard cap on a single import batch — a legacy localStorage payload is
// bounded by what a person could plausibly have built by hand in the old UI.
const MAX_LEGACY_IMPORT_TEAMS = 50;

// The fields the import writes, checked on the untrusted payload. The slot
// check is the one parseLegacyTeamsPayload narrows the stored payload with.
const isValidLegacyTeam = ({ team }: { team: unknown }): boolean =>
  isRecord(team) &&
  typeof team.name === "string" &&
  team.name.trim() !== "" &&
  isActionArray(team.slots) &&
  isValidSlots({ slots: team.slots });

type LegacyTeamRow = { name: string; slug: string; slots: readonly RosterSlot[] };

// Each team's trimmed name, and a slug no earlier team in the batch holds. The
// import only writes into an empty league, so the batch is the whole namespace.
const toLegacyTeamRows = ({ teams }: { teams: readonly FantasyTeam[] }): LegacyTeamRow[] =>
  teams.reduce<LegacyTeamRow[]>((rows, team) => {
    const name = team.name.trim();
    const slug = uniqueSlug({
      base: teamNameToSlug({ name }),
      taken: rows.map((row) => row.slug),
    });
    return [...rows, { name, slug, slots: team.slots }];
  }, []);

// One-time import of the pre-league localStorage teams into the caller's
// default league. Only runs against an empty league — if teams already exist
// server-side, the legacy payload is stale and is skipped rather than merged.
export const importLegacyTeams = async ({
  teams,
}: {
  teams: readonly FantasyTeam[];
}): Promise<LegacyTeamsImportResult> => {
  // Checked before `.length`/`.every` below: a non-array argument would
  // otherwise escape as a 500 rather than a result union.
  if (!isActionArray(teams)) return { status: "error" };
  if (teams.length > MAX_LEGACY_IMPORT_TEAMS) return { status: "error" };
  if (!teams.every((team) => isValidLegacyTeam({ team }))) return { status: "error" };
  const rows = toLegacyTeamRows({ teams });

  return withProfile<LegacyTeamsImportResult>({
    getProfile,
    run: async ({ profile }) => {
      // Pass the already-resolved profile through so ensureDefaultLeague
      // doesn't re-fetch the session a second time.
      const league = await ensureDefaultLeague({ profile });
      if (league === null) return { status: "unauthenticated" };
      // Legacy teams were hand-built; they never belong in an imported league,
      // whose teams are its host's.
      if (league.isImported) return { status: "skipped" };

      return prisma.$transaction(async (tx) => {
        // Re-checked inside the transaction (not just before it) so two
        // concurrent imports — a double-invoke or two tabs — can't both read
        // "empty" and both write; the slug unique constraint is the second
        // line of defense if this still races across transactions.
        const existingCount = await tx.leagueTeam.count({ where: { leagueId: league.id } });
        if (existingCount > 0) return { status: "skipped" };
        if (rows.length === 0) return { status: "ok" };

        const created = await tx.leagueTeam.createManyAndReturn({
          data: rows.map(({ name, slug }) => ({
            leagueId: league.id,
            profileId: profile.id,
            name,
            slug,
          })),
          select: { id: true, slug: true },
        });
        // Matched back by slug, which is unique within the league, rather than
        // trusting the order RETURNING happens to hand the rows back in.
        const teamIdBySlug = new Map(created.map((team) => [team.slug, team.id]));
        const teamIdOf = ({ slug }: { slug: string }): string => {
          const teamId = teamIdBySlug.get(slug);
          if (teamId === undefined) throw new Error(`importLegacyTeams: no row for "${slug}"`);
          return teamId;
        };
        await writeSlots({
          tx,
          profileId: profile.id,
          teams: rows.map(({ slug, slots }) => ({ teamId: teamIdOf({ slug }), slots })),
        });
        return { status: "ok" };
      });
    },
  });
};

export const deleteLeagueTeam = async ({
  teamId,
}: {
  teamId: string;
}): Promise<LeagueTeamDeleteResult> => {
  // Without this the annotation above is the only thing standing between a
  // caller and `where: { id: { not: "" } }`, which turns this single-row
  // delete into "every team I own", cascading their slots with it.
  if (!isActionId(teamId)) return { status: "error" };

  return withProfile<LeagueTeamDeleteResult>({
    getProfile,
    run: async ({ profile }) => {
      // Only a hand-built league's teams can be deleted; an imported league's
      // teams belong to its host.
      const deleted = await prisma.leagueTeam.deleteMany({
        where: { id: teamId, profileId: profile.id, league: { provider: "manual" } },
      });
      if (deleted.count > 0) return { status: "ok" };
      // Idempotent: deleting an already-gone or unowned team still reports
      // ok, since the end state the caller wants is "team is gone". A team
      // that's still there was refused because its league is imported.
      const remaining = await prisma.leagueTeam.findFirst({
        where: { id: teamId, profileId: profile.id },
        select: { id: true },
      });
      return remaining === null ? { status: "ok" } : { status: "error" };
    },
  });
};

"use server";

import { type Prisma } from "@generated/prisma/client";

import { isActionId, isActionText } from "@vision/core/util/argGuards";
import { getProfile } from "@/lib/auth/session";
import { withProfile } from "@/lib/auth/withProfile";
import { teamNameToSlug } from "@vision/core/roster/slug";
import { MAX_LEAGUES } from "@vision/core/league/constants";
import { isLeagueScoringType } from "@vision/core/league/scoring";
import { parseScoringConfig } from "@vision/sport-basketball/engine";
import { toLeagueSummary } from "@/lib/leagues/queries";
import { clampInt, LEAGUE_BOUNDS } from "@/lib/leagues/settings";
import { uniqueSlug } from "@vision/core/league/slug";
import {
  type LeagueDeleteResult,
  type LeagueMutationResult,
  type SetActiveLeagueResult,
} from "@/lib/leagues/types";
import { type LeagueScoringConfig } from "@vision/sport-basketball/types";
import { prisma } from "@/lib/prisma";
import { lockProfile } from "@/lib/leagues/locks";
import { hasPrismaCode, PRISMA_RECORD_NOT_FOUND } from "@/lib/prismaErrors";

type CreateLeagueProps = {
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
};

export const createLeague = async ({
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: CreateLeagueProps): Promise<LeagueMutationResult> => {
  if (!isActionText(name)) return { status: "invalid" };
  return withProfile<LeagueMutationResult>({
    getProfile,
    run: async ({ profile }) => {
      const trimmed = name.trim();
      if (trimmed === "" || !isLeagueScoringType(scoringType)) return { status: "invalid" };
      const config = parseScoringConfig({ scoringType, value: scoringConfig });
      return prisma.$transaction(async (tx) => {
        await lockProfile({ tx, profileId: profile.id });
        const existing = await tx.league.findMany({
          where: { profileId: profile.id },
          select: { slug: true },
        });
        if (existing.length >= MAX_LEAGUES) return { status: "limit" };
        const league = await tx.league.create({
          data: {
            profileId: profile.id,
            name: trimmed,
            slug: uniqueSlug({
              base: teamNameToSlug({ name: trimmed }),
              taken: existing.map((row) => row.slug),
            }),
            scoringType,
            teamCount: clampInt({ value: teamCount, ...LEAGUE_BOUNDS.teams }),
            rosterSlots: clampInt({ value: rosterSlots, ...LEAGUE_BOUNDS.slots }),
            scoringConfig: { ...config },
          },
        });
        // A user's first league becomes active without a second click.
        await tx.profile.updateMany({
          where: { id: profile.id, activeLeagueId: null },
          data: { activeLeagueId: league.id },
        });
        return { status: "ok", league: toLeagueSummary({ league }) };
      });
    },
  });
};

// Ownership in the where: a forged leagueId matches no row, and Prisma
// reports that as P2025 rather than updating someone else's league.
type WriteLeagueProps = {
  where: Prisma.LeagueWhereUniqueInput;
  data: Prisma.LeagueUpdateInput;
};

const writeLeague = async ({ where, data }: WriteLeagueProps): Promise<LeagueMutationResult> => {
  try {
    const league = await prisma.league.update({ where, data });
    return { status: "ok", league: toLeagueSummary({ league }) };
  } catch (error) {
    if (hasPrismaCode({ error, code: PRISMA_RECORD_NOT_FOUND })) return { status: "invalid" };
    throw error;
  }
};

type UpdateLeagueProps = {
  leagueId: string;
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
};

export const updateLeague = async ({
  leagueId,
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: UpdateLeagueProps): Promise<LeagueMutationResult> => {
  // An object here would reach the `where` below as a Prisma filter, matching
  // every league the caller owns instead of one.
  if (!isActionId(leagueId) || !isActionText(name)) return { status: "invalid" };
  return withProfile<LeagueMutationResult>({
    getProfile,
    run: async ({ profile }) => {
      const trimmed = name.trim();
      if (trimmed === "") return { status: "invalid" };
      const owned = await prisma.league.findFirst({
        where: { id: leagueId, profileId: profile.id },
        select: { provider: true },
      });
      if (owned === null) return { status: "invalid" };
      // An imported league's scoring and size are its host's: only the name
      // is the user's to change, and the scoring arguments are ignored. Tests
      // the raw column so a provider this build doesn't know fails closed.
      if (owned.provider !== "manual") {
        return writeLeague({
          where: { id: leagueId, profileId: profile.id },
          data: { name: trimmed },
        });
      }
      if (!isLeagueScoringType(scoringType)) return { status: "invalid" };
      const config = parseScoringConfig({ scoringType, value: scoringConfig });
      // Scoped to a hand-built league in the write itself too, so the scoring
      // can never land on an imported league whatever the read above saw.
      return writeLeague({
        where: { id: leagueId, profileId: profile.id, provider: "manual" },
        data: {
          name: trimmed,
          scoringType,
          teamCount: clampInt({ value: teamCount, ...LEAGUE_BOUNDS.teams }),
          rosterSlots: clampInt({ value: rosterSlots, ...LEAGUE_BOUNDS.slots }),
          scoringConfig: { ...config },
        },
      });
    },
  });
};

type DeleteLeagueProps = {
  leagueId: string;
};

export const deleteLeague = async ({
  leagueId,
}: DeleteLeagueProps): Promise<LeagueDeleteResult> => {
  // Without this, `{ not: "" }` deletes every league the caller owns and
  // cascades to their teams, slots, and watchlists, then reports success.
  if (!isActionId(leagueId)) return { status: "error" };
  return withProfile<LeagueDeleteResult>({
    getProfile,
    // One transaction, so the active pointer can never be left aimed at the
    // league just deleted, or at a fallback another request removed meanwhile.
    run: ({ profile }) =>
      prisma.$transaction(async (tx) => {
        const current = await lockProfile({ tx, profileId: profile.id });
        const deleted = await tx.league.deleteMany({
          where: { id: leagueId, profileId: profile.id },
        });
        if (deleted.count === 0) return { status: "error" };
        // Deleting a non-active league must not touch the active pointer.
        if (current.activeLeagueId !== leagueId) {
          return { status: "ok", activeLeagueId: current.activeLeagueId };
        }
        const fallback = await tx.league.findFirst({
          where: { profileId: profile.id },
          orderBy: { updatedAt: "desc" },
        });
        const activeLeagueId = fallback?.id ?? null;
        await tx.profile.update({
          where: { id: profile.id },
          data: { activeLeagueId },
        });
        return { status: "ok", activeLeagueId };
      }),
  });
};

type SetActiveLeagueProps = {
  leagueId: string;
};

export const setActiveLeague = async ({
  leagueId,
}: SetActiveLeagueProps): Promise<SetActiveLeagueResult> => {
  if (!isActionId(leagueId)) return { status: "error" };
  return withProfile<SetActiveLeagueResult>({
    getProfile,
    run: ({ profile }) =>
      prisma.$transaction(async (tx) => {
        await lockProfile({ tx, profileId: profile.id });
        const owned = await tx.league.findFirst({
          where: { id: leagueId, profileId: profile.id },
          select: { id: true },
        });
        if (owned === null) return { status: "error" };
        await tx.profile.update({
          where: { id: profile.id },
          data: { activeLeagueId: leagueId },
        });
        return { status: "ok" };
      }),
  });
};

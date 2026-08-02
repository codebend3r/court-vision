"use server";

import { getProfile } from "@/lib/auth/session";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { MAX_LEAGUES } from "@/lib/leagues/constants";
import { isLeagueScoringType, parseScoringConfig } from "@/lib/leagues/guards";
import { toLeagueSummary } from "@/lib/leagues/queries";
import { uniqueSlug } from "@/lib/leagues/slug";
import {
  type LeagueDeleteResult,
  type LeagueMutationResult,
  type LeagueScoringConfig,
  type SetActiveLeagueResult,
} from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

const clampInt = ({
  value,
  min,
  max,
  fallback,
}: {
  value: number;
  min: number;
  max: number;
  fallback: number;
}): number => (Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

export const createLeague = async ({
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: {
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
}): Promise<LeagueMutationResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  const trimmed = name.trim();
  if (trimmed === "" || !isLeagueScoringType(scoringType)) return { status: "invalid" };
  const config = parseScoringConfig({ scoringType, value: scoringConfig });
  try {
    return await prisma.$transaction(async (tx) => {
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
            base: teamNameToSlug(trimmed),
            taken: existing.map((row) => row.slug),
          }),
          scoringType,
          teamCount: clampInt({ value: teamCount, min: 2, max: 30, fallback: 12 }),
          rosterSlots: clampInt({ value: rosterSlots, min: 1, max: 25, fallback: 13 }),
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
  } catch {
    return { status: "error" };
  }
};

export const updateLeague = async ({
  leagueId,
  name,
  scoringType,
  teamCount,
  rosterSlots,
  scoringConfig,
}: {
  leagueId: string;
  name: string;
  scoringType: string;
  teamCount: number;
  rosterSlots: number;
  scoringConfig: LeagueScoringConfig;
}): Promise<LeagueMutationResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  const trimmed = name.trim();
  if (trimmed === "" || !isLeagueScoringType(scoringType)) return { status: "invalid" };
  const config = parseScoringConfig({ scoringType, value: scoringConfig });
  try {
    // updateMany + ownership in the where: a forged leagueId updates 0 rows.
    const updated = await prisma.league.updateMany({
      where: { id: leagueId, profileId: profile.id },
      data: {
        name: trimmed,
        scoringType,
        teamCount: clampInt({ value: teamCount, min: 2, max: 30, fallback: 12 }),
        rosterSlots: clampInt({ value: rosterSlots, min: 1, max: 25, fallback: 13 }),
        scoringConfig: { ...config },
      },
    });
    if (updated.count === 0) return { status: "invalid" };
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (league === null) return { status: "error" };
    return { status: "ok", league: toLeagueSummary({ league }) };
  } catch {
    return { status: "error" };
  }
};

export const deleteLeague = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<LeagueDeleteResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    const deleted = await prisma.league.deleteMany({
      where: { id: leagueId, profileId: profile.id },
    });
    if (deleted.count === 0) return { status: "error" };
    // Deleting a non-active league must not touch the active pointer.
    if (profile.activeLeagueId !== leagueId) {
      return { status: "ok", activeLeagueId: profile.activeLeagueId };
    }
    const fallback = await prisma.league.findFirst({
      where: { profileId: profile.id },
      orderBy: { updatedAt: "desc" },
    });
    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: fallback?.id ?? null },
    });
    return { status: "ok", activeLeagueId: fallback?.id ?? null };
  } catch {
    return { status: "error" };
  }
};

export const setActiveLeague = async ({
  leagueId,
}: {
  leagueId: string;
}): Promise<SetActiveLeagueResult> => {
  const profile = await getProfile();
  if (profile === null) return { status: "unauthenticated" };
  try {
    const owned = await prisma.league.findFirst({
      where: { id: leagueId, profileId: profile.id },
      select: { id: true },
    });
    if (owned === null) return { status: "error" };
    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: leagueId },
    });
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
};

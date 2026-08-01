import { type League, type Profile } from "@generated/prisma/client";

import { getProfile } from "@/lib/auth/session";
import { DEFAULT_LEAGUE_NAME, DEFAULT_LEAGUE_SLUG } from "@/lib/leagues/constants";
import {
  defaultScoringConfig,
  isLeagueScoringType,
  parseScoringConfig,
} from "@/lib/leagues/guards";
import { type LeagueSummary } from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";

// A stored scoringType predates a rename or was tampered with → treat the
// league as h2h_categories rather than crash.
export const toLeagueSummary = ({ league }: { league: League }): LeagueSummary => {
  const scoringType = isLeagueScoringType(league.scoringType)
    ? league.scoringType
    : "h2h_categories";
  return {
    id: league.id,
    name: league.name,
    slug: league.slug,
    scoringType,
    teamCount: league.teamCount,
    rosterSlots: league.rosterSlots,
    scoringConfig: parseScoringConfig({ scoringType, value: league.scoringConfig }),
    createdAt: league.createdAt.toISOString(),
  };
};

export const getLeagues = async (): Promise<LeagueSummary[]> => {
  const profile = await getProfile();
  if (profile === null) return [];
  const leagues = await prisma.league.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" },
  });
  return leagues.map((league) => toLeagueSummary({ league }));
};

// Read-only resolution for RSC render paths: prefers activeLeagueId, falls
// back to the most recently updated league WITHOUT persisting anything —
// writes during render are ensureDefaultLeague's job, called from actions.
export const resolveActiveLeague = async ({
  profile,
}: {
  profile: Profile;
}): Promise<League | null> => {
  if (profile.activeLeagueId !== null) {
    const active = await prisma.league.findUnique({ where: { id: profile.activeLeagueId } });
    if (active !== null) return active;
  }
  return prisma.league.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" },
  });
};

export const getActiveLeague = async (): Promise<LeagueSummary | null> => {
  const profile = await getProfile();
  if (profile === null) return null;
  const league = await resolveActiveLeague({ profile });
  return league === null ? null : toLeagueSummary({ league });
};

// Server-action entry point: guarantees a league exists and is active. Spread
// the config into a fresh literal — Prisma's InputJsonValue needs an index
// signature, which a fresh object literal satisfies without a cast.
export const ensureDefaultLeague = async (): Promise<LeagueSummary | null> => {
  const profile = await getProfile();
  if (profile === null) return null;
  const existing = await resolveActiveLeague({ profile });
  if (existing !== null) {
    if (profile.activeLeagueId !== existing.id) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { activeLeagueId: existing.id },
      });
    }
    return toLeagueSummary({ league: existing });
  }
  const config = defaultScoringConfig({ scoringType: "h2h_categories" });
  const created = await prisma.league.create({
    data: {
      profileId: profile.id,
      name: DEFAULT_LEAGUE_NAME,
      slug: DEFAULT_LEAGUE_SLUG,
      scoringType: "h2h_categories",
      scoringConfig: { ...config },
    },
  });
  await prisma.profile.update({
    where: { id: profile.id },
    data: { activeLeagueId: created.id },
  });
  return toLeagueSummary({ league: created });
};

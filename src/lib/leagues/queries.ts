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

// Prisma's unique-constraint code. Same pattern as
// src/lib/watchlist/actions.ts: losing a create race to a concurrent caller
// is a "someone else already did it" outcome, not an error.
const UNIQUE_VIOLATION = "P2002";

const isUniqueViolation = ({ error }: { error: unknown }): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;

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
    updatedAt: league.updatedAt.toISOString(),
  };
};

// Matches resolveActiveLeague's DB-side fallback (most-recently-updated) so
// the nav's active-league display and the data paths that actually read/write
// against a league can never disagree about which one is "active" when the
// profile's pointer is missing or stale. Pure so layout/leagues-page can call
// it directly against the LeagueSummary[] they already fetched, no extra query.
export const fallbackActiveLeagueId = ({
  leagues,
  activeLeagueId,
}: {
  leagues: readonly LeagueSummary[];
  activeLeagueId: string | null;
}): string | null => {
  if (activeLeagueId !== null && leagues.some((league) => league.id === activeLeagueId)) {
    return activeLeagueId;
  }
  const [mostRecentlyUpdated] = [...leagues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return mostRecentlyUpdated?.id ?? null;
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
    // Scoped by owner: a stale/forged activeLeagueId pointing at someone
    // else's league must fall through to this profile's own leagues, never
    // resolve to a row it doesn't own.
    const active = await prisma.league.findFirst({
      where: { id: profile.activeLeagueId, profileId: profile.id },
    });
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
// signature, which a fresh object literal satisfies without a cast. Accepts
// an already-resolved profile so a caller that resolved it for another
// reason (e.g. to stamp profileId on rows it's about to write) doesn't pay
// for a second session lookup.
// Points the profile's activeLeagueId at `league` if it isn't already there,
// then summarizes. Shared by both the "found one" and "just created/won the
// create race" paths below.
const activateAndSummarize = async ({
  profile,
  league,
}: {
  profile: Profile;
  league: League;
}): Promise<LeagueSummary> => {
  if (profile.activeLeagueId !== league.id) {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: league.id },
    });
  }
  return toLeagueSummary({ league });
};

export const ensureDefaultLeague = async ({
  profile: providedProfile,
}: { profile?: Profile } = {}): Promise<LeagueSummary | null> => {
  const profile = providedProfile ?? (await getProfile());
  if (profile === null) return null;
  const existing = await resolveActiveLeague({ profile });
  if (existing !== null) return activateAndSummarize({ profile, league: existing });

  const config = defaultScoringConfig({ scoringType: "h2h_categories" });
  try {
    const created = await prisma.league.create({
      data: {
        profileId: profile.id,
        name: DEFAULT_LEAGUE_NAME,
        slug: DEFAULT_LEAGUE_SLUG,
        scoringType: "h2h_categories",
        scoringConfig: { ...config },
      },
    });
    return await activateAndSummarize({ profile, league: created });
  } catch (error) {
    if (!isUniqueViolation({ error })) throw error;
    // Lost the create race: a concurrent call for the same profile already
    // created the default league (profileId+slug is unique) between our
    // resolve above and this create. Converge on that winner instead of
    // throwing — re-resolving finds the row the other caller just wrote.
    const winner = await resolveActiveLeague({ profile });
    if (winner === null) throw error;
    return activateAndSummarize({ profile, league: winner });
  }
};

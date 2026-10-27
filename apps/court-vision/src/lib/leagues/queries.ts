import { type League, type Profile, type Prisma } from "@generated/prisma/client";
import { cache } from "react";

import { getProfile } from "@/lib/auth/session";
import { DEFAULT_LEAGUE_NAME, DEFAULT_LEAGUE_SLUG } from "@vision/core/league/constants";
import { isLeagueScoringType } from "@vision/core/league/scoring";
import { defaultScoringConfig, parseScoringConfig } from "@vision/sport-basketball/engine";
import { type LeagueSummary, toLeagueProvider, toLeagueSyncVia } from "@/lib/leagues/types";
import { prisma } from "@/lib/prisma";
import { lockProfile } from "@/lib/leagues/locks";

// A stored scoringType predates a rename or was tampered with → treat the
// league as h2h_categories rather than crash. An unknown provider likewise
// displays as "manual", but `isImported` tests the raw column so it stays
// locked.
type ToLeagueSummaryProps = { league: League };

export const toLeagueSummary = ({ league }: ToLeagueSummaryProps): LeagueSummary => {
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
    provider: toLeagueProvider({ value: league.provider }),
    syncVia: toLeagueSyncVia({ value: league.syncVia }),
    isImported: league.provider !== "manual",
    externalUrl: league.externalUrl,
    myTeamId: league.myTeamId,
    syncedAt: league.syncedAt?.toISOString() ?? null,
    syncError: league.syncError,
    unsupportedCategories: [...league.unsupportedCategories],
    createdAt: league.createdAt.toISOString(),
    updatedAt: league.updatedAt.toISOString(),
  };
};

// Matches resolveActiveLeague's DB-side fallback (most-recently-updated) so
// the nav's active-league display and the data paths that actually read/write
// against a league can never disagree about which one is "active" when the
// profile's pointer is missing or stale. Pure so layout/leagues-page can call
// it directly against the LeagueSummary[] they already fetched, no extra query.
type FallbackActiveLeagueIdProps = {
  leagues: readonly LeagueSummary[];
  activeLeagueId: string | null;
};

export const fallbackActiveLeagueId = ({
  leagues,
  activeLeagueId,
}: FallbackActiveLeagueIdProps): string | null => {
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
type ResolveActiveLeagueProps = {
  profile: Profile;
  client?: Prisma.TransactionClient;
};

export const resolveActiveLeague = async ({
  profile,
  client = prisma,
}: ResolveActiveLeagueProps): Promise<League | null> => {
  if (profile.activeLeagueId !== null) {
    // Scoped by owner: a stale/forged activeLeagueId pointing at someone
    // else's league must fall through to this profile's own leagues, never
    // resolve to a row it doesn't own.
    const active = await client.league.findFirst({
      where: { id: profile.activeLeagueId, profileId: profile.id },
    });
    if (active !== null) return active;
  }
  return client.league.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" },
  });
};

// The session's active league row, deduped per request with React `cache` the
// same way getProfile is: the root layout's watchlist read, the page, and its
// panels each ask for it, and without this every one resolves it again.
// resolveActiveLeague itself stays uncached (it takes a fresh profile object
// per call, so a cache keyed on it would never hit).
export const getActiveLeagueRecord = cache(async (): Promise<League | null> => {
  const profile = await getProfile();
  if (profile === null) return null;
  return resolveActiveLeague({ profile });
});

export const getActiveLeague = async (): Promise<LeagueSummary | null> => {
  const league = await getActiveLeagueRecord();
  return league === null ? null : toLeagueSummary({ league });
};

// Server-action entry point: guarantees a league exists and is active. Spread
// the config into a fresh literal — Prisma's InputJsonValue needs an index
// signature, which a fresh object literal satisfies without a cast. Accepts
// an already-resolved profile so a caller that resolved it for another
// reason (e.g. to stamp profileId on rows it's about to write) doesn't pay
// for a second session lookup.
// Points the profile's activeLeagueId at `league` if it isn't already there,
// then summarizes. Both the existing-league and creation paths hold the same
// profile lock, so activation cannot overwrite another concurrent selection.
type ActivateAndSummarizeProps = {
  profile: Profile;
  league: League;
  tx: Prisma.TransactionClient;
};

const activateAndSummarize = async ({
  profile,
  league,
  tx,
}: ActivateAndSummarizeProps): Promise<LeagueSummary> => {
  if (profile.activeLeagueId !== league.id) {
    await tx.profile.update({
      where: { id: profile.id },
      data: { activeLeagueId: league.id },
    });
  }
  return toLeagueSummary({ league });
};

type EnsureDefaultLeagueProps = { profile?: Profile; expectedLeagueId?: string | null };

export const ensureDefaultLeague = async ({
  profile: providedProfile,
  expectedLeagueId,
}: EnsureDefaultLeagueProps = {}): Promise<LeagueSummary | null> => {
  const profile = providedProfile ?? (await getProfile());
  if (profile === null) return null;
  return prisma.$transaction(async (tx) => {
    const current = { ...profile, ...(await lockProfile({ tx, profileId: profile.id })) };
    const existing = await resolveActiveLeague({ profile: current, client: tx });
    // Refuse a stale tab instead of writing to a league it never displayed.
    if (expectedLeagueId !== undefined && expectedLeagueId !== (existing?.id ?? null)) return null;
    if (existing !== null) return activateAndSummarize({ profile: current, league: existing, tx });

    const config = defaultScoringConfig({ scoringType: "h2h_categories" });
    const created = await tx.league.create({
      data: {
        profileId: profile.id,
        name: DEFAULT_LEAGUE_NAME,
        slug: DEFAULT_LEAGUE_SLUG,
        scoringType: "h2h_categories",
        scoringConfig: { ...config },
      },
    });
    return activateAndSummarize({ profile: current, league: created, tx });
  });
};

import { beforeEach, describe, expect, it, vi } from "bun:test";

type SlotRow = {
  teamId: string;
  profileId: string;
  slotType: string;
  position: number;
  playerId: number | null;
  externalPlayerKey: string | null;
  externalPlayerName: string | null;
  injuryStatus: string | null;
};
type WaiverRow = {
  leagueId: string;
  playerId: number;
  profileId: string;
  injuryStatus: string | null;
};
type TeamData = {
  leagueId: string;
  profileId: string;
  name: string;
  slug: string;
  externalKey: string;
  logoUrl: string | null;
  managerName: string | null;
};
type TeamUpsert = {
  where: { leagueId_externalKey: { leagueId: string; externalKey: string } };
  create: TeamData;
  update: Partial<TeamData>;
};

const leagueFindMany = vi.fn<() => Promise<{ slug: string }[]>>();
const leagueCreate = vi.fn<() => Promise<League>>();
const leagueUpdate = vi.fn<() => Promise<League>>();
const teamCreate = vi.fn<(args: { data: TeamData }) => Promise<{ id: string; slug: string }>>();
const teamFindMany =
  vi.fn<() => Promise<{ id: string; slug: string; externalKey: string | null }[]>>();
const teamUpsert = vi.fn<(args: TeamUpsert) => Promise<{ id: string }>>();
const teamDeleteMany = vi.fn<() => Promise<{ count: number }>>();
const slotDeleteMany = vi.fn<() => Promise<{ count: number }>>();
const slotCreateMany = vi.fn<(args: { data: SlotRow[] }) => Promise<{ count: number }>>();
const waiverDeleteMany = vi.fn<() => Promise<{ count: number }>>();
const waiverCreateMany =
  vi.fn<(args: { data: WaiverRow[]; skipDuplicates: boolean }) => Promise<{ count: number }>>();
const profileUpdate = vi.fn<() => Promise<{ id: string }>>();
const leagueFindUniqueOrThrow = vi.fn<() => Promise<League>>();

const tx = {
  league: {
    findMany: leagueFindMany,
    create: leagueCreate,
    update: leagueUpdate,
    findUniqueOrThrow: leagueFindUniqueOrThrow,
  },
  leagueTeam: {
    create: teamCreate,
    findMany: teamFindMany,
    upsert: teamUpsert,
    deleteMany: teamDeleteMany,
  },
  leagueTeamSlot: { deleteMany: slotDeleteMany, createMany: slotCreateMany },
  leagueWaiverPlayer: { deleteMany: waiverDeleteMany, createMany: waiverCreateMany },
  profile: { update: profileUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));

import { type League } from "@generated/prisma/client";

import { prisma } from "@/lib/prisma";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import { type ResolvedPlayers } from "@/lib/yahoo/matchPlayers";
import { createImportedLeague, syncImportedLeague } from "@/lib/yahoo/persist";
import { yahooLeagueSnapshotSchema } from "@/lib/yahoo/schemas";
import { toImportedLeague } from "@/lib/yahoo/transform";
import { type ImportedLeague, type ImportedTeam, type YahooPlayerRef } from "@/lib/yahoo/types";

const PROFILE_ID = "prof-1";
const LEAGUE_ID = "league-1";
const GASOL = "478.l.106344.t.1";
const KEEPERS = "478.l.106344.t.2";
const NEWFOUNDLANDERS = "478.l.106344.t.5";
const DREAM_SHAKE = "478.l.106344.t.12";
const ANTHONY_BLACK = "10095";
const KEVIN_PORTER = "6218";

const importedLeague = (): ImportedLeague => {
  const result = toImportedLeague({ snapshot: yahooLeagueSnapshotSchema.parse(league106344) });
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.league;
};

const ref = (overrides: Partial<YahooPlayerRef>): YahooPlayerRef => ({
  yahooPlayerId: "1",
  fullName: "Someone",
  teamAbbr: null,
  eligiblePositions: [],
  status: null,
  ...overrides,
});

// Anthony Black is the one roster player Court Vision knows; everyone else is unmatched.
const resolved: ResolvedPlayers = { byYahooId: new Map([[ANTHONY_BLACK, 501]]), unmatched: [] };

const teamIdOf = ({ externalKey }: { externalKey: string }): string => `team-${externalKey}`;

const leagueRow: League = {
  id: LEAGUE_ID,
  profileId: PROFILE_ID,
  name: "Game of Courts",
  slug: "game-of-courts-2",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  provider: "yahoo",
  syncVia: "server",
  externalKey: "478.l.106344",
  externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
  myTeamId: null,
  syncedAt: new Date("2026-10-16T12:00:00Z"),
  syncError: null,
  unsupportedCategories: [],
  createdAt: new Date("2026-10-16T12:00:00Z"),
  updatedAt: new Date("2026-10-16T12:00:00Z"),
};
const updatedRow: League = { ...leagueRow, myTeamId: teamIdOf({ externalKey: NEWFOUNDLANDERS }) };
// The row as read back after a sync whose deletes cleared `myTeamId` (SetNull).
const rereadRow: League = { ...updatedRow, myTeamId: null };

type CreateArgs = Parameters<typeof createImportedLeague>[0];
type SyncArgs = Parameters<typeof syncImportedLeague>[0];

// Each call runs inside the mocked `prisma.$transaction`, so `client` is typed
// as Prisma's transaction client while it is the double above at runtime.
const create = (args: Omit<CreateArgs, "tx">) =>
  prisma.$transaction((client) => createImportedLeague({ ...args, tx: client }));

const sync = (args: Omit<SyncArgs, "tx">) =>
  prisma.$transaction((client) => syncImportedLeague({ ...args, tx: client }));

const slotRows = (): SlotRow[] => slotCreateMany.mock.calls[0]?.[0]?.data ?? [];

const blackRows = (): SlotRow[] => slotRows().filter(({ playerId }) => playerId === 501);

const upsertFor = ({ externalKey }: { externalKey: string }): TeamUpsert => {
  const upsert = teamUpsert.mock.calls
    .map(([args]) => args)
    .find(({ where }) => where.leagueId_externalKey.externalKey === externalKey);
  if (upsert === undefined) throw new Error(`no upsert for ${externalKey}`);
  return upsert;
};

const findTeam = ({
  league,
  externalKey,
}: {
  league: ImportedLeague;
  externalKey: string;
}): ImportedTeam => {
  const team = league.teams.find((candidate) => candidate.externalKey === externalKey);
  if (team === undefined) throw new Error(`no team ${externalKey}`);
  return team;
};

beforeEach(() => {
  [
    leagueFindMany,
    leagueCreate,
    leagueUpdate,
    teamCreate,
    teamFindMany,
    teamUpsert,
    teamDeleteMany,
    slotDeleteMany,
    slotCreateMany,
    waiverDeleteMany,
    waiverCreateMany,
    profileUpdate,
    leagueFindUniqueOrThrow,
  ].forEach((mock) => mock.mockReset());

  leagueFindMany.mockResolvedValue([{ slug: "game-of-courts" }]);
  leagueCreate.mockResolvedValue(leagueRow);
  leagueUpdate.mockResolvedValue(updatedRow);
  leagueFindUniqueOrThrow.mockResolvedValue(rereadRow);
  teamCreate.mockImplementation(async ({ data }) => ({
    id: teamIdOf({ externalKey: data.externalKey }),
    slug: data.slug,
  }));
  teamFindMany.mockResolvedValue([]);
  teamUpsert.mockImplementation(async ({ where }) => ({
    id: teamIdOf({ externalKey: where.leagueId_externalKey.externalKey }),
  }));
  teamDeleteMany.mockResolvedValue({ count: 0 });
  slotDeleteMany.mockResolvedValue({ count: 0 });
  slotCreateMany.mockResolvedValue({ count: 0 });
  waiverDeleteMany.mockResolvedValue({ count: 0 });
  waiverCreateMany.mockResolvedValue({ count: 0 });
  profileUpdate.mockResolvedValue({ id: PROFILE_ID });
});

describe("createImportedLeague", () => {
  it("creates the league, teams, slots and waivers in one transaction", async () => {
    const league = importedLeague();
    const stewart = ref({ yahooPlayerId: "6408", fullName: "Isaiah Stewart", status: "O" });

    const created = await create({
      profileId: PROFILE_ID,
      league,
      resolved: { byYahooId: new Map([...resolved.byYahooId, ["6408", 701]]), unmatched: [] },
      waiverRefs: [stewart],
      myTeamExternalKey: NEWFOUNDLANDERS,
    });

    expect(leagueCreate).toHaveBeenCalledWith({
      data: {
        profileId: PROFILE_ID,
        name: "Game of Courts",
        slug: "game-of-courts-2",
        provider: "yahoo",
        externalKey: "478.l.106344",
        externalUrl: "https://basketball.fantasysports.yahoo.com/nba/106344",
        scoringType: league.scoring.scoringType,
        scoringConfig: league.scoring.scoringConfig,
        unsupportedCategories: league.scoring.unsupportedCategories,
        teamCount: 12,
        rosterSlots: 13,
        syncedAt: expect.any(Date),
      },
    });

    const teams = teamCreate.mock.calls.map(([args]) => args.data);
    expect(teams).toHaveLength(12);
    expect(new Set(teams.map(({ slug }) => slug)).size).toBe(12);
    expect(teams.find(({ externalKey }) => externalKey === GASOL)).toEqual({
      leagueId: LEAGUE_ID,
      profileId: PROFILE_ID,
      name: "Better Call Gasol",
      slug: "better-call-gasol",
      externalKey: GASOL,
      logoUrl: findTeam({ league, externalKey: GASOL }).logoUrl,
      managerName: null,
    });

    expect(blackRows()).toEqual([
      {
        teamId: teamIdOf({ externalKey: GASOL }),
        profileId: PROFILE_ID,
        slotType: "SG",
        position: 1,
        playerId: 501,
        externalPlayerKey: null,
        externalPlayerName: null,
        injuryStatus: "Q",
      },
    ]);
    expect(
      slotRows().filter(({ externalPlayerKey }) => externalPlayerKey === KEVIN_PORTER),
    ).toEqual([
      {
        teamId: teamIdOf({ externalKey: GASOL }),
        profileId: PROFILE_ID,
        slotType: "G",
        position: 3,
        playerId: null,
        externalPlayerKey: KEVIN_PORTER,
        externalPlayerName: "Kevin Porter Jr.",
        injuryStatus: "Q",
      },
    ]);
    const gasolRows = slotRows().filter((row) => row.teamId === teamIdOf({ externalKey: GASOL }));
    expect(gasolRows.map(({ position }) => position)).toEqual(
      findTeam({ league, externalKey: GASOL }).slots.map((_, index) => index),
    );
    expect(gasolRows.at(-1)).toMatchObject({
      slotType: "IL",
      playerId: null,
      externalPlayerKey: null,
      externalPlayerName: null,
      injuryStatus: null,
    });
    expect(slotRows()).toHaveLength(
      league.teams.reduce((total, team) => total + team.slots.length, 0),
    );

    expect(waiverCreateMany).toHaveBeenCalledWith({
      data: [{ leagueId: LEAGUE_ID, playerId: 701, profileId: PROFILE_ID, injuryStatus: "O" }],
      skipDuplicates: true,
    });
    expect(leagueUpdate).toHaveBeenCalledWith({
      where: { id: LEAGUE_ID },
      data: { myTeamId: teamIdOf({ externalKey: NEWFOUNDLANDERS }) },
    });
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { activeLeagueId: LEAGUE_ID },
    });
    expect(created).toBe(updatedRow);
  });

  it("gives teams that share a name distinct slugs", async () => {
    const league = importedLeague();
    const twins: ImportedLeague = {
      ...league,
      teams: league.teams.map((team) =>
        team.externalKey === KEEPERS ? { ...team, name: "Better Call Gasol" } : team,
      ),
    };

    await create({
      profileId: PROFILE_ID,
      league: twins,
      resolved,
      waiverRefs: [],
      myTeamExternalKey: NEWFOUNDLANDERS,
    });

    const slugs = teamCreate.mock.calls.map(([args]) => args.data.slug);
    expect(slugs.slice(0, 2)).toEqual(["better-call-gasol", "better-call-gasol-2"]);
  });

  it("refuses a my-team key that isn't one of the league's teams", async () => {
    await expect(
      create({
        profileId: PROFILE_ID,
        league: importedLeague(),
        resolved,
        waiverRefs: [],
        myTeamExternalKey: "478.l.999.t.1",
      }),
    ).rejects.toThrow('createImportedLeague: team "478.l.999.t.1" is not in league 478.l.106344');
    expect(leagueCreate).not.toHaveBeenCalled();
    expect(teamCreate).not.toHaveBeenCalled();
  });

  it("stores only matched waiver players, with their injury status", async () => {
    await create({
      profileId: PROFILE_ID,
      league: importedLeague(),
      resolved: {
        byYahooId: new Map([
          ["6408", 701],
          ["7001", 702],
        ]),
        unmatched: [],
      },
      waiverRefs: [
        ref({ yahooPlayerId: "6408", fullName: "Isaiah Stewart", status: "O" }),
        ref({ yahooPlayerId: "9999", fullName: "Nobody Known", status: "INJ" }),
        ref({ yahooPlayerId: "7001", fullName: "Healthy Guard", status: null }),
      ],
      myTeamExternalKey: NEWFOUNDLANDERS,
    });

    expect(waiverCreateMany).toHaveBeenCalledWith({
      data: [
        { leagueId: LEAGUE_ID, playerId: 701, profileId: PROFILE_ID, injuryStatus: "O" },
        { leagueId: LEAGUE_ID, playerId: 702, profileId: PROFILE_ID, injuryStatus: null },
      ],
      skipDuplicates: true,
    });
  });

  it("writes no waiver rows when no waiver player matched", async () => {
    await create({
      profileId: PROFILE_ID,
      league: importedLeague(),
      resolved,
      waiverRefs: [ref({ yahooPlayerId: "9999" })],
      myTeamExternalKey: NEWFOUNDLANDERS,
    });

    expect(waiverCreateMany).not.toHaveBeenCalled();
  });
});

describe("syncImportedLeague", () => {
  it("re-syncs by external key", async () => {
    const original = importedLeague();
    const black = findTeam({ league: original, externalKey: GASOL }).slots.find(
      ({ player }) => player !== null && player.yahooPlayerId === ANTHONY_BLACK,
    );
    if (black === undefined) throw new Error("Anthony Black is not on Gasol");
    // Gasol is renamed and trades Anthony Black to Keepers; Dream Shake is new
    // to Court Vision, and t.99 is gone from Yahoo.
    const league: ImportedLeague = {
      ...original,
      name: "Renamed in Yahoo",
      teams: original.teams.map((team) => {
        if (team.externalKey === GASOL) {
          return {
            ...team,
            name: "Gasol Renamed",
            logoUrl: "https://s.yimg.com/new-logo.png",
            slots: team.slots.map((slot) => (slot === black ? { ...slot, player: null } : slot)),
          };
        }
        if (team.externalKey === KEEPERS) {
          return { ...team, managerName: "Kim", slots: [...team.slots, black] };
        }
        return team;
      }),
    };
    const existing = original.teams
      .filter(({ externalKey }) => externalKey !== DREAM_SHAKE)
      .map(({ externalKey, name }) => ({
        id: teamIdOf({ externalKey }),
        slug: name === "Better Call Gasol" ? "better-call-gasol" : externalKey,
        externalKey,
      }));
    teamFindMany.mockResolvedValue([
      ...existing,
      { id: "team-gone", slug: "dream-shake", externalKey: "478.l.106344.t.99" },
    ]);

    const synced = await sync({
      profileId: PROFILE_ID,
      leagueId: LEAGUE_ID,
      league,
      resolved,
      waiverRefs: [ref({ yahooPlayerId: ANTHONY_BLACK, status: "Q" })],
    });

    expect(leagueUpdate).toHaveBeenCalledWith({
      where: {
        id: LEAGUE_ID,
        profileId: PROFILE_ID,
        provider: "yahoo",
        externalKey: "478.l.106344",
      },
      data: {
        externalUrl: league.externalUrl,
        scoringType: league.scoring.scoringType,
        scoringConfig: league.scoring.scoringConfig,
        unsupportedCategories: league.scoring.unsupportedCategories,
        teamCount: 12,
        rosterSlots: 13,
        syncedAt: expect.any(Date),
        syncError: null,
      },
    });
    // Read back last, so the result reflects `myTeamId` after the team deletes.
    expect(leagueFindUniqueOrThrow).toHaveBeenCalledWith({ where: { id: LEAGUE_ID } });
    expect(synced).toBe(rereadRow);

    expect(teamDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["team-gone"] }, leagueId: LEAGUE_ID, profileId: PROFILE_ID },
    });

    // Deleted before any upsert, so a new team can take a vanished team's slug.
    expect(teamDeleteMany.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
      teamUpsert.mock.invocationCallOrder[0] ?? 0,
    );

    expect(teamUpsert).toHaveBeenCalledTimes(12);
    const gasol = upsertFor({ externalKey: GASOL });
    expect(gasol.where).toEqual({
      leagueId_externalKey: { leagueId: LEAGUE_ID, externalKey: GASOL },
    });
    expect(gasol.update).toEqual({
      name: "Gasol Renamed",
      logoUrl: "https://s.yimg.com/new-logo.png",
    });
    expect(gasol.create.slug).toBe("better-call-gasol");
    expect(upsertFor({ externalKey: KEEPERS }).update).toEqual({
      name: "Fuck Your Keepers",
      logoUrl: findTeam({ league, externalKey: KEEPERS }).logoUrl,
      managerName: "Kim",
    });
    // The vanished team's slug is free again, so the new team may take it.
    expect(upsertFor({ externalKey: DREAM_SHAKE }).create).toMatchObject({
      slug: "dream-shake",
      name: "Dream Shake",
      externalKey: DREAM_SHAKE,
    });

    expect(slotDeleteMany).toHaveBeenCalledWith({
      where: { team: { leagueId: LEAGUE_ID }, profileId: PROFILE_ID },
    });
    expect(blackRows()).toEqual([
      expect.objectContaining({ teamId: teamIdOf({ externalKey: KEEPERS }), playerId: 501 }),
    ]);
    expect(new Set(slotRows().map(({ teamId }) => teamId))).toEqual(
      new Set(league.teams.map(({ externalKey }) => teamIdOf({ externalKey }))),
    );
    expect(slotDeleteMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      slotCreateMany.mock.invocationCallOrder[0] ?? 0,
    );

    expect(waiverDeleteMany).toHaveBeenCalledWith({
      where: { leagueId: LEAGUE_ID, profileId: PROFILE_ID },
    });
    expect(waiverCreateMany).toHaveBeenCalledWith({
      data: [{ leagueId: LEAGUE_ID, playerId: 501, profileId: PROFILE_ID, injuryStatus: "Q" }],
      skipDuplicates: true,
    });
    expect(waiverDeleteMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      waiverCreateMany.mock.invocationCallOrder[0] ?? 0,
    );
    expect(waiverCreateMany.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
      leagueFindUniqueOrThrow.mock.invocationCallOrder[0] ?? 0,
    );

    expect(teamCreate).not.toHaveBeenCalled();
    expect(profileUpdate).not.toHaveBeenCalled();
  });
});

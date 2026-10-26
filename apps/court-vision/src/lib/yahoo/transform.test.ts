import { describe, expect, it } from "bun:test";

import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import playersPage from "@/lib/yahoo/fixtures/players-page-106344.json";
import scoreboard106344 from "@/lib/yahoo/fixtures/scoreboard-106344.json";
import waivers from "@/lib/yahoo/fixtures/waivers-106344.json";
import {
  type YahooLeagueSnapshot,
  type YahooPlayer,
  yahooLeagueSnapshotSchema,
  yahooPlayersPageSchema,
  yahooScoreboardSchema,
} from "@/lib/yahoo/schemas";
import { toImportedLeague, toPlayerRefs } from "@/lib/yahoo/transform";
import { type ImportedLeague } from "@/lib/yahoo/types";

const snapshot = yahooLeagueSnapshotSchema.parse(league106344);

const importedLeague = ({ from }: { from: YahooLeagueSnapshot }): ImportedLeague => {
  const result = toImportedLeague({ snapshot: from });
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.league;
};

const withRoster = ({
  teamKey,
  players,
}: {
  teamKey: string;
  players: YahooPlayer[];
}): YahooLeagueSnapshot => {
  const league = snapshot.fantasy_content.league;
  return {
    fantasy_content: {
      league: {
        ...league,
        teams: league.teams.map((team) =>
          team.team_key === teamKey ? { ...team, roster: { players } } : team,
        ),
      },
    },
  };
};

const player = ({ id, position }: { id: string; position: string | undefined }): YahooPlayer => ({
  player_id: id,
  name: { full: `Player ${id}` },
  editorial_team_abbr: undefined,
  display_position: undefined,
  eligible_positions: ["C", "Util"],
  status: undefined,
  selected_position: position === undefined ? undefined : { position },
});

const NEWFOUNDLANDERS = "478.l.106344.t.5";

describe("toImportedLeague", () => {
  it("imports every team with its name, logo and roster", () => {
    const league = importedLeague({ from: snapshot });
    const team = league.teams.find(({ externalKey }) => externalKey === NEWFOUNDLANDERS);

    expect(league.externalKey).toBe("478.l.106344");
    expect(league.externalUrl).toBe("https://basketball.fantasysports.yahoo.com/nba/106344");
    expect(league.season).toBe(2026);
    expect(league.teamCount).toBe(12);
    expect(league.teams).toHaveLength(12);
    expect(team?.name).toBe("Newfoundlanders");
    expect(team?.logoUrl?.startsWith("https://yahoofantasysports-res.cloudinary.com/")).toBe(true);
    expect(team?.managerName).toBeNull();
    expect(team?.isOwnedByCurrentLogin).toBe(false);
    expect(team?.slots).toHaveLength(15);
    expect(team?.slots.filter(({ player: seated }) => !!seated)).toHaveLength(13);
  });

  it("seats each player in the slot Yahoo selected", () => {
    const team = importedLeague({ from: snapshot }).teams.find(
      ({ externalKey }) => externalKey === NEWFOUNDLANDERS,
    );

    expect(team?.slots[0]?.slotType).toBe("PG");
    expect(team?.slots[0]?.player?.fullName).toBe("Ty Jerome");
    expect(
      team?.slots.some(
        ({ slotType, player: seated }) => slotType === "G" && seated?.fullName === "Kevin Durant",
      ),
    ).toBe(true);
    expect(team?.slots.slice(-2).map(({ slotType }) => slotType)).toEqual(["IL", "IL"]);
  });

  it("appends overflow and unknown-position players as extra slots", () => {
    const league = importedLeague({
      from: withRoster({
        teamKey: NEWFOUNDLANDERS,
        players: [
          player({ id: "1", position: "C" }),
          player({ id: "2", position: "C" }),
          player({ id: "3", position: "C" }),
          player({ id: "4", position: undefined }),
        ],
      }),
    });
    const team = league.teams.find(({ externalKey }) => externalKey === NEWFOUNDLANDERS);
    const centers = team?.slots.filter(({ slotType }) => slotType === "C") ?? [];

    expect(team?.slots).toHaveLength(15 + 3);
    expect(centers.map(({ player: seated }) => seated?.yahooPlayerId)).toEqual(["1", "2", "3"]);
    expect(team?.slots.at(-1)).toMatchObject({ slotType: "BENCH" });
    expect(team?.slots.at(-1)?.player?.yahooPlayerId).toBe("4");
  });

  it("keeps the position label Yahoo prints for each player", () => {
    const refs = importedLeague({ from: snapshot }).teams.flatMap(({ slots }) =>
      slots.flatMap(({ player: seated }) => (seated ? [seated] : [])),
    );

    expect(refs.find(({ fullName }) => fullName === "Anthony Black")?.displayPosition).toBe(
      "PG,SG,SF",
    );
    expect(refs.every(({ displayPosition }) => displayPosition !== "")).toBe(true);
  });

  it("lists the scored categories in Yahoo's order, turnovers lower-wins, display-only stats left out", () => {
    const { statCategories } = importedLeague({ from: snapshot });

    expect(statCategories.map(({ displayName }) => displayName)).toEqual([
      "FG%",
      "FT%",
      "3PTM",
      "PTS",
      "REB",
      "AST",
      "ST",
      "BLK",
      "TO",
    ]);
    expect(statCategories.filter(({ higherIsBetter }) => !higherIsBetter)).toEqual([
      { statId: 19, displayName: "TO", higherIsBetter: false },
    ]);
  });

  it("turns the scoreboard into matchups of two teams' totals", () => {
    const result = toImportedLeague({
      snapshot,
      scoreboard: yahooScoreboardSchema.parse(scoreboard106344),
    });
    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.league.matchups).toHaveLength(6);
    const [first] = result.league.matchups ?? [];
    expect(first).toMatchObject({ week: 1, weekStart: "2026-10-20", weekEnd: "2026-10-25" });
    expect(first?.sides.map(({ teamKey }) => teamKey)).toEqual([
      "478.l.106344.t.1",
      "478.l.106344.t.2",
    ]);
    expect(first?.sides[0]?.stats["17"]).toBe("10");
  });

  it("distinguishes an unavailable scoreboard from an empty week", () => {
    expect(importedLeague({ from: snapshot }).matchups).toBeNull();
    const result = toImportedLeague({
      snapshot,
      scoreboard: { fantasy_content: { league: { scoreboard: { matchups: [] } } } },
    });
    expect(result.status === "ok" && result.league.matchups).toEqual([]);
  });

  it("keeps a bye team's totals without an opponent", () => {
    const parsed = yahooScoreboardSchema.parse(scoreboard106344);
    const matchups = parsed.fantasy_content.league.scoreboard.matchups;
    const [first, ...rest] = matchups;
    if (!first) throw new Error("fixture");
    const lopsided = {
      fantasy_content: {
        league: {
          scoreboard: { matchups: [{ ...first, teams: first.teams.slice(0, 1) }, ...rest] },
        },
      },
    };

    const result = toImportedLeague({ snapshot, scoreboard: lopsided });
    if (result.status !== "ok") throw new Error("expected ok");

    expect(result.league.matchups).toHaveLength(6);
    expect(result.league.matchups?.[0]?.sides).toEqual([
      { teamKey: first.teams[0]?.team_key, stats: expect.objectContaining({ "17": "10" }) },
    ]);
  });

  it("reads injury status and eligibility", () => {
    const refs = importedLeague({ from: snapshot }).teams.flatMap(({ slots }) =>
      slots.flatMap(({ player: seated }) => (seated ? [seated] : [])),
    );
    const black = refs.find(({ fullName }) => fullName === "Anthony Black");
    const durant = refs.find(({ fullName }) => fullName === "Kevin Durant");

    expect(black?.status).toBe("Q");
    expect(black?.eligiblePositions).toEqual(["PG", "SG", "G", "SF", "F", "Util"]);
    expect(durant?.status).toBeNull();
    expect(black?.teamAbbr).toEqual(expect.any(String));
  });

  it("names the manager unless Yahoo hides it", () => {
    const league = snapshot.fantasy_content.league;
    const named = importedLeague({
      from: {
        fantasy_content: {
          league: {
            ...league,
            teams: league.teams.map((team, index) => ({
              ...team,
              is_owned_by_current_login: index === 0,
              managers: index === 0 ? [{ nickname: "CJ" }] : team.managers,
            })),
          },
        },
      },
    });

    expect(named.teams[0]?.managerName).toBe("CJ");
    expect(named.teams[0]?.isOwnedByCurrentLogin).toBe(true);
    expect(named.teams[1]?.managerName).toBeNull();
  });

  it("passes unsupported settings through", () => {
    const league = snapshot.fantasy_content.league;

    expect(
      toImportedLeague({
        snapshot: { fantasy_content: { league: { ...league, is_highscore: true } } },
      }),
    ).toEqual({ status: "unsupported", reason: "highscore" });
  });
});

describe("toPlayerRefs", () => {
  it("flattens waiver pages into refs", () => {
    const page = yahooPlayersPageSchema.parse(waivers);
    const refs = toPlayerRefs({ pages: [page, page] });
    const ids = refs.map(({ yahooPlayerId }) => yahooPlayerId);

    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(refs).toHaveLength(page.fantasy_content.league.players.length);
  });

  it("keeps players from different pages in page order", () => {
    const first = yahooPlayersPageSchema.parse(waivers);
    const second = yahooPlayersPageSchema.parse(playersPage);
    const refs = toPlayerRefs({ pages: [first, second] });

    expect(refs[0]?.yahooPlayerId).toBe(first.fantasy_content.league.players[0]?.player_id);
    expect(refs.length).toBeGreaterThanOrEqual(second.fantasy_content.league.players.length);
  });
});

import { describe, expect, it } from "bun:test";

import game from "@/lib/yahoo/fixtures/game-nba.json";
import league1000 from "@/lib/yahoo/fixtures/league-1000.json";
import league106344 from "@/lib/yahoo/fixtures/league-106344.json";
import playersPage from "@/lib/yahoo/fixtures/players-page-106344.json";
import scoreboard from "@/lib/yahoo/fixtures/scoreboard-106344.json";
import waivers from "@/lib/yahoo/fixtures/waivers-106344.json";
import {
  yahooFlagSchema,
  yahooGameSchema,
  yahooLeagueSnapshotSchema,
  yahooPlayersPageSchema,
  yahooScoreboardSchema,
} from "@/lib/yahoo/schemas";

const base106344LogoUrl = league106344.fantasy_content.league.logo_url;

describe("yahooLeagueSnapshotSchema", () => {
  it("parses both recorded league snapshots", () => {
    const gameOfCourts = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;
    const winner = yahooLeagueSnapshotSchema.parse(league1000).fantasy_content.league;

    expect(gameOfCourts.teams).toHaveLength(12);
    expect(gameOfCourts.teams[0]?.name).toBe("Better Call Gasol");
    expect(gameOfCourts.teams[0]?.roster.players).toHaveLength(13);
    expect(gameOfCourts.settings.stat_categories.stats).toHaveLength(11);
    expect(winner.teams).toHaveLength(10);
    expect(winner.settings.roster_positions.map((slot) => slot.position)).toContain("BN");
  });

  it("unwraps ids, collections and eligibility into plain values", () => {
    const league = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;
    const team = league.teams[0];
    const player = team?.roster.players[0];

    expect(league.league_id).toBe("106344");
    expect(league.num_teams).toBe(12);
    expect(league.season).toBe(2026);
    expect(team?.team_id).toBe("1");
    expect(team?.team_logos[0]?.url).toStartWith("https://yahoofantasysports-res.cloudinary.com/");
    expect(team?.managers[0]?.nickname).toBe("--hidden--");
    expect(team?.is_owned_by_current_login).toBe(false);
    expect(player?.player_id).toBe("6734");
    expect(player?.name.full).toBe("Ryan Rollins");
    expect(player?.editorial_team_abbr).toBe("MIL");
    expect(player?.eligible_positions).toEqual(["PG", "SG", "G", "Util"]);
    expect(player?.selected_position?.position).toBe("PG");
    expect(league.settings.stat_categories.stats[0]?.stat_id).toBe(9004003);
    expect(league.settings.stat_categories.stats[0]?.is_only_display_stat).toBe(true);
    expect(league.settings.stat_categories.stats[1]?.is_only_display_stat).toBe(false);
    expect(league.settings.roster_positions[8]).toEqual({
      position: "IL",
      count: 2,
      is_starting_position: false,
    });
  });

  it("reads injury status from rostered players", () => {
    const league = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;
    const players = league.teams.flatMap((team) => team.roster.players);

    expect(players.find((player) => player.name.full === "Anthony Black")?.status).toBe("Q");
    expect(players.find((player) => player.name.full === "Jimmy Butler III")?.status).toBe("O");
    expect(players.find((player) => player.name.full === "Ryan Rollins")?.status).toBeUndefined();
  });

  it("treats null is_highscore and stat_modifiers as absent", () => {
    const league = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;

    expect(league.is_highscore).toBe(false);
    expect(league.settings.is_highscore).toBe(false);
    expect(league.settings.stat_modifiers).toBeUndefined();
  });

  it("flags High Score leagues", () => {
    const highscore = {
      fantasy_content: {
        league: { ...league106344.fantasy_content.league, is_highscore: "1" },
      },
    };

    expect(yahooLeagueSnapshotSchema.parse(highscore).fantasy_content.league.is_highscore).toBe(
      true,
    );
  });

  it("unwraps a points league's stat modifiers", () => {
    const base = league106344.fantasy_content.league;
    const points = {
      fantasy_content: {
        league: {
          ...base,
          settings: {
            ...base.settings,
            stat_modifiers: { stats: [{ stat: { stat_id: 12, value: "1.5" } }] },
          },
        },
      },
    };

    expect(
      yahooLeagueSnapshotSchema.parse(points).fantasy_content.league.settings.stat_modifiers,
    ).toEqual([{ stat_id: 12, value: 1.5 }]);
  });

  it("rejects a null or blank stat_id and modifier value rather than reading 0", () => {
    const base = league106344.fantasy_content.league;
    const withModifier = (stat: unknown) => ({
      fantasy_content: {
        league: { ...base, settings: { ...base.settings, stat_modifiers: { stats: [{ stat }] } } },
      },
    });
    const withStatId = (stat_id: unknown) => ({
      fantasy_content: {
        league: {
          ...base,
          settings: {
            ...base.settings,
            stat_categories: { stats: [{ stat: { stat_id, display_name: "X" } }] },
          },
        },
      },
    });

    expect(
      yahooLeagueSnapshotSchema.safeParse(withModifier({ stat_id: 12, value: null })).success,
    ).toBe(false);
    expect(
      yahooLeagueSnapshotSchema.safeParse(withModifier({ stat_id: 12, value: "" })).success,
    ).toBe(false);
    expect(
      yahooLeagueSnapshotSchema.safeParse(withModifier({ stat_id: 12, value: "abc" })).success,
    ).toBe(false);
    expect(
      yahooLeagueSnapshotSchema.safeParse(withModifier({ stat_id: null, value: 1 })).success,
    ).toBe(false);
    expect(yahooLeagueSnapshotSchema.safeParse(withStatId(null)).success).toBe(false);
    expect(yahooLeagueSnapshotSchema.safeParse(withStatId("")).success).toBe(false);
    expect(yahooLeagueSnapshotSchema.safeParse(withStatId("12")).success).toBe(true);
    expect(
      yahooLeagueSnapshotSchema.safeParse(withModifier({ stat_id: 19, value: "-1" })).success,
    ).toBe(true);
  });

  it("rejects a null season, team count or player id", () => {
    const base = league106344.fantasy_content.league;
    const parse = (patch: Record<string, unknown>) =>
      yahooLeagueSnapshotSchema.safeParse({ fantasy_content: { league: { ...base, ...patch } } });

    expect(parse({ season: null }).success).toBe(false);
    expect(parse({ num_teams: "" }).success).toBe(false);
    expect(parse({ league_id: null }).success).toBe(false);
    expect(
      yahooGameSchema.safeParse({ fantasy_content: { game: { game_key: "478", season: null } } })
        .success,
    ).toBe(false);
  });

  it("gives a team with no roster an empty one", () => {
    const base = league106344.fantasy_content.league;
    const { roster: _roster, ...bare } = base.teams[0]?.team ?? {};
    const body = {
      fantasy_content: { league: { ...base, teams: [{ team: bare }] } },
    };

    expect(
      yahooLeagueSnapshotSchema.parse(body).fantasy_content.league.teams[0]?.roster.players,
    ).toEqual([]);
  });

  it("rejects a league url that isn't https on a Yahoo host", () => {
    const base = league106344.fantasy_content.league;
    const withUrl = (url: string) => ({ fantasy_content: { league: { ...base, url } } });

    [
      "http://basketball.fantasysports.yahoo.com/nba/106344",
      "https://evil.com/nba/106344",
      "https://basketball.fantasysports.yahoo.com.evil.com/nba/106344",
      "javascript:alert(1)",
      "not a url",
    ].forEach((url) => {
      expect(yahooLeagueSnapshotSchema.safeParse(withUrl(url)).success).toBe(false);
    });
    expect(
      yahooLeagueSnapshotSchema.parse(withUrl("https://BASKETBALL.fantasysports.yahoo.com/nba/1"))
        .fantasy_content.league.url,
    ).toBe("https://BASKETBALL.fantasysports.yahoo.com/nba/1");
  });

  it("keeps logos on Yahoo's image hosts", () => {
    const league = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;
    const logoUrls = league.teams.map((team) => team.team_logos[0]?.url);

    expect(league.logo_url).toBe(base106344LogoUrl);
    expect(logoUrls.every((url) => url !== undefined)).toBe(true);
  });

  it("treats a league or team logo off Yahoo's hosts as absent", () => {
    const base = league106344.fantasy_content.league;
    const [firstTeam, ...otherTeams] = base.teams;
    const offHost = ({ logoUrl, teamLogoUrl }: { logoUrl: string; teamLogoUrl: string }) => ({
      fantasy_content: {
        league: {
          ...base,
          logo_url: logoUrl,
          teams: [
            {
              team: {
                ...firstTeam?.team,
                team_logos: [{ team_logo: { size: "large", url: teamLogoUrl } }],
              },
            },
            ...otherTeams,
          ],
        },
      },
    });

    [
      { logoUrl: "https://evil.com/logo.png", teamLogoUrl: "https://evil.com/team.png" },
      { logoUrl: "http://s.yimg.com/logo.png", teamLogoUrl: "http://s.yimg.com/team.png" },
      { logoUrl: "https://s.yimg.com.evil.com/logo.png", teamLogoUrl: "data:image/png;base64,AA" },
    ].forEach((urls) => {
      const league = yahooLeagueSnapshotSchema.parse(offHost(urls)).fantasy_content.league;
      expect(league.logo_url).toBeUndefined();
      expect(league.teams[0]?.team_logos[0]?.url).toBeUndefined();
      expect(league.teams).toHaveLength(12);
    });
  });

  it("rejects a body without fantasy_content", () => {
    expect(yahooLeagueSnapshotSchema.safeParse({ error: { description: "x" } }).success).toBe(
      false,
    );
  });
});

describe("player display position", () => {
  it("reads the label Yahoo prints under a player's name", () => {
    const page = yahooPlayersPageSchema.parse(waivers);

    expect(page.fantasy_content.league.players[0]?.display_position).toBe("PF,C");
  });

  it("treats a player without one as absent", () => {
    const page = yahooPlayersPageSchema.parse({
      fantasy_content: {
        league: { players: [{ player: { player_id: "1", name: { full: "No Label" } } }] },
      },
    });

    expect(page.fantasy_content.league.players[0]?.display_position).toBeUndefined();
  });
});

describe("league stat categories and week", () => {
  it("reads the sort order that says which way a category is won", () => {
    const league = yahooLeagueSnapshotSchema.parse(league106344).fantasy_content.league;
    const byName = new Map(
      league.settings.stat_categories.stats.map((stat) => [stat.display_name, stat.sort_order]),
    );

    expect(byName.get("TO")).toBe("0");
    expect(byName.get("PTS")).toBe("1");
    expect(league.current_week).toBe(1);
  });
});

describe("yahooScoreboardSchema", () => {
  it("unwraps matchups, their teams and each team's week totals", () => {
    const { matchups } = yahooScoreboardSchema.parse(scoreboard).fantasy_content.league.scoreboard;

    expect(matchups).toHaveLength(6);
    const [first] = matchups;
    expect(first).toMatchObject({ week: 1, week_start: "2026-10-20", status: "midevent" });
    expect(first?.teams.map(({ team_key }) => team_key)).toEqual([
      "478.l.106344.t.1",
      "478.l.106344.t.2",
    ]);
    expect(first?.teams[0]?.team_stats.stats).toContainEqual({ stat_id: 17, value: "10" });
  });

  it("reads a scoreboard with no matchups as an empty week", () => {
    expect(
      yahooScoreboardSchema.parse({ fantasy_content: { league: { scoreboard: {} } } })
        .fantasy_content.league.scoreboard.matchups,
    ).toEqual([]);
  });

  it("rejects a body without a scoreboard", () => {
    expect(yahooScoreboardSchema.safeParse({ fantasy_content: { league: {} } }).success).toBe(
      false,
    );
  });
});

describe("yahooGameSchema", () => {
  it("parses the current game", () => {
    const parsed = yahooGameSchema.parse(game);

    expect(parsed.fantasy_content.game.game_key).toBe("478");
    expect(parsed.fantasy_content.game.season).toBe(2026);
  });

  it("rejects a body without fantasy_content", () => {
    expect(yahooGameSchema.safeParse({ error: { description: "x" } }).success).toBe(false);
  });
});

describe("yahooPlayersPageSchema", () => {
  it("parses a players page, including an empty one", () => {
    const page = yahooPlayersPageSchema.parse(waivers);
    const real = yahooPlayersPageSchema.parse(playersPage);

    expect(page.fantasy_content.league.players.map((player) => player.name.full)).toEqual([
      "Isaiah Stewart",
    ]);
    expect(page.fantasy_content.league.players[0]?.status).toBe("O");
    expect(real.fantasy_content.league.players.map((player) => player.player_id)).toEqual([
      "6018",
      "6226",
    ]);
    expect(real.fantasy_content.league.players[0]?.eligible_positions).toEqual(["C", "Util"]);
    expect(
      yahooPlayersPageSchema.parse({ fantasy_content: { league: { players: [] } } }).fantasy_content
        .league.players,
    ).toEqual([]);
    expect(
      yahooPlayersPageSchema.parse({ fantasy_content: { league: {} } }).fantasy_content.league
        .players,
    ).toEqual([]);
  });

  it("rejects a body without fantasy_content", () => {
    expect(yahooPlayersPageSchema.safeParse({ error: { description: "x" } }).success).toBe(false);
  });
});

describe("yahooFlagSchema", () => {
  it("reads 1, '1' and true as set", () => {
    expect([1, "1", true].map((value) => yahooFlagSchema.parse(value))).toEqual([true, true, true]);
  });

  it("reads 0, '0', false, null and undefined as unset", () => {
    expect([0, "0", false, null, undefined].map((value) => yahooFlagSchema.parse(value))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("rejects values Yahoo never sends", () => {
    expect(yahooFlagSchema.safeParse("yes").success).toBe(false);
    expect(yahooFlagSchema.safeParse(2).success).toBe(false);
  });
});

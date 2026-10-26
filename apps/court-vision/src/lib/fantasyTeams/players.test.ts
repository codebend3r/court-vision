import { describe, expect, it } from "bun:test";

import { fantasyPlayersFromPool } from "@/lib/fantasyTeams/players";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";
import { makeStatLine } from "@/lib/valuation/fixtures";

const rookie: FantasyTeamPlayer = {
  playerId: 1057262817,
  firstName: "AJ",
  lastName: "Dybantsa",
  fullName: "AJ Dybantsa",
  teamAbbr: "WAS",
  position: "F",
  nbaPersonId: 1643407,
};

type LineProps = {
  playerId: number;
  firstName: string;
  lastName: string;
};

const line = ({ playerId, firstName, lastName }: LineProps) =>
  makeStatLine({ playerId, firstName, lastName, fullName: `${firstName} ${lastName}` });

describe("fantasyPlayersFromPool", () => {
  it("maps stat lines to builder players, alphabetized by last then first name", () => {
    const players = fantasyPlayersFromPool({
      lines: [
        line({ playerId: 1, firstName: "Stephen", lastName: "Curry" }),
        line({ playerId: 2, firstName: "Seth", lastName: "Curry" }),
        line({ playerId: 3, firstName: "Bam", lastName: "Adebayo" }),
      ],
    });

    expect(players.map((player) => player.fullName)).toEqual([
      "Bam Adebayo",
      "Seth Curry",
      "Stephen Curry",
    ]);
  });

  it("adds active-roster players who have no stat line, so rookies are searchable", () => {
    const players = fantasyPlayersFromPool({
      lines: [line({ playerId: 1, firstName: "Stephen", lastName: "Curry" })],
      activePlayers: [rookie],
    });

    expect(players.map((player) => player.playerId)).toEqual([1, 1057262817]);
    expect(players[1]).toEqual(rookie);
  });

  it("keeps one entry for a player with both a stat line and an active-roster row", () => {
    const players = fantasyPlayersFromPool({
      lines: [line({ playerId: 1, firstName: "Stephen", lastName: "Curry" })],
      activePlayers: [{ ...rookie, playerId: 1, firstName: "Stephen", lastName: "Curry" }],
    });

    expect(players).toHaveLength(1);
  });
});

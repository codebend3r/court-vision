import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { type TeamBuilderProps } from "@/components/TeamBuilder/TeamBuilder";

const builderProps = vi.fn();

// TeamEditor is a thin pass-through to the same builder /my-teams/create uses;
// the builder itself is fully covered by TeamBuilder.test.tsx, so here we only
// assert the server-resolved team/leagueId/players/insights reach it intact.
vi.mock("@/components/TeamBuilder/TeamBuilder", () => ({
  TeamBuilder: (props: TeamBuilderProps) => {
    builderProps(props);
    return <p>team builder</p>;
  },
}));

import { TeamEditor } from "@/components/TeamEditor/TeamEditor";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const team: FantasyTeam = {
  id: "team-1",
  name: "Bench Mob",
  createdAt: "2026-07-23T00:00:00.000Z",
  slots: buildSlots({ counts: DEFAULT_SLOT_COUNTS }),
};

const players: FantasyTeamPlayer[] = [
  {
    playerId: 1,
    firstName: "Jalen",
    lastName: "Brunson",
    fullName: "Jalen Brunson",
    teamAbbr: "NYK",
    position: "G",
    nbaPersonId: null,
  },
];

describe("TeamEditor", () => {
  it("hands the server-resolved team and league down to the builder", () => {
    render(<TeamEditor leagueId="league-1" team={team} players={players} insights={[]} />);
    expect(screen.getByText("team builder")).toBeInTheDocument();
    expect(builderProps).toHaveBeenCalledWith({
      leagueId: "league-1",
      team,
      players,
      insights: [],
    });
  });
});

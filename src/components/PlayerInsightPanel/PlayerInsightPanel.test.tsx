import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlayerInsightPanel } from "@/components/PlayerInsightPanel/PlayerInsightPanel";
import { type PlayerInsight } from "@/lib/fantasyTeams/insights";
import { type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const player: FantasyTeamPlayer = {
  playerId: 1,
  firstName: "Jalen",
  lastName: "Brunson",
  fullName: "Jalen Brunson",
  teamAbbr: "NYK",
  position: "G",
  nbaPersonId: null,
};

const insight: PlayerInsight = {
  playerId: 1,
  gamesPlayed: 68,
  minutesPerGame: 35.4,
  z: 2.1,
  overallRank: 12,
  overallOf: 512,
  positionRank: 3,
  positionOf: 96,
  positionGroup: "G",
  categories: [
    { key: "pts", label: "PTS", perGame: 28.7, z: 1.9, kind: "counting" },
    { key: "fg", label: "FG%", perGame: 0.488, z: 0.4, kind: "ratio" },
    { key: "reb", label: "REB", perGame: 3.6, z: -0.4, kind: "counting" },
  ],
};

describe("PlayerInsightPanel", () => {
  it("prompts to hover when no player is provided", () => {
    render(<PlayerInsightPanel player={null} insight={null} />);
    expect(screen.getByText(/hover a player/i)).toBeInTheDocument();
  });

  it("shows the total z-score and overall + positional ranks", () => {
    render(<PlayerInsightPanel player={player} insight={insight} />);
    expect(screen.getByText("Jalen Brunson")).toBeInTheDocument();
    expect(screen.getByText("+2.10")).toBeInTheDocument();
    expect(screen.getByText("Among G")).toBeInTheDocument();
    expect(screen.getByText(/68 GP/)).toBeInTheDocument();
  });

  it("formats per-game rates with a leading dot and counting stats to one decimal", () => {
    render(<PlayerInsightPanel player={player} insight={insight} />);
    const ptsRow = screen.getByRole("row", { name: /PTS/ });
    expect(within(ptsRow).getByText("28.7")).toBeInTheDocument();
    expect(within(ptsRow).getByText("+1.9")).toBeInTheDocument();
    const fgRow = screen.getByRole("row", { name: /FG%/ });
    expect(within(fgRow).getByText(".488")).toBeInTheDocument();
    const rebRow = screen.getByRole("row", { name: /REB/ });
    expect(within(rebRow).getByText("-0.4")).toBeInTheDocument();
  });
});

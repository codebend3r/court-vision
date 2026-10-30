import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { HomeAdvicePanel } from "@/components/HomeAdvicePanel/HomeAdvicePanel";
import { type AdvisorPlayer } from "@/lib/advisor/types";
import { type HomeAdvice } from "@/lib/home/insights";

afterEach(cleanup);

const target: AdvisorPlayer = {
  playerId: 3,
  fullName: "Trae Young",
  teamAbbr: "ATL",
  position: "PG",
  injuryStatus: null,
  value: 4.24,
  categoryScore: 1,
  focusScores: [],
  owner: { kind: "team", teamId: "t", teamName: "Rivals", managerName: null },
};

const advice: HomeAdvice = {
  weakness: { key: "ast", label: "AST", myTotal: 0, leagueAverage: 1, rank: 12, of: 12 },
  focusLabel: "AST",
  tradeTargets: [target],
  freeAgents: [],
};

describe("HomeAdvicePanel", () => {
  it("lists trade targets with their owner and value, and links to the trades", () => {
    render(<HomeAdvicePanel kind="trades" advice={advice} methodLabel="Z-Score" />);

    expect(screen.getByRole("heading", { name: "Top Trade Targets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trae Young" })).toHaveAttribute("href", "/players/3");
    expect(screen.getByText(/Rivals/)).toBeInTheDocument();
    expect(screen.getByText("+4.2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See trades" })).toHaveAttribute("href", "/advisor");
  });

  it("says so when its list is empty, and points free agents at the pickups tab", () => {
    render(<HomeAdvicePanel kind="free_agents" advice={advice} methodLabel="Z-Score" />);

    expect(screen.getByRole("heading", { name: "Top Free Agents" })).toBeInTheDocument();
    expect(screen.getByText("No free agent is valued yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See pickups" })).toHaveAttribute(
      "href",
      "/advisor?tab=free_agents",
    );
  });

  it("points to the Yahoo import with no advice", () => {
    render(<HomeAdvicePanel kind="trades" advice={null} methodLabel="Z-Score" />);

    expect(screen.getByText(/Import your Yahoo league/)).toBeInTheDocument();
  });
});

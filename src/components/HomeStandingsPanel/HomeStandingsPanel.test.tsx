import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import {
  HOME_STANDINGS_LIMIT,
  HomeStandingsPanel,
} from "@/components/HomeStandingsPanel/HomeStandingsPanel";
import { type ConferenceTeamStanding } from "@/lib/standings/standings";

afterEach(cleanup);

const team = ({
  rank,
  conference,
}: {
  rank: number;
  conference: string;
}): ConferenceTeamStanding => ({
  teamId: rank * (conference === "East" ? 1 : 100),
  abbreviation: `${conference === "East" ? "E" : "W"}${rank}`,
  fullName: `${conference} Team ${rank}`,
  rank,
  wins: 60 - rank,
  losses: 22 + rank,
});

const ladder = ({ conference, size }: { conference: string; size: number }) =>
  Array.from({ length: size }, (_, index) => team({ rank: index + 1, conference }));

describe("HomeStandingsPanel", () => {
  it("shows both conference ladders with records", () => {
    render(
      <HomeStandingsPanel
        standings={{
          east: ladder({ conference: "East", size: 3 }),
          west: ladder({ conference: "West", size: 3 }),
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Conference Standings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "East" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "West" })).toBeInTheDocument();
    expect(screen.getByText("E1")).toBeInTheDocument();
    expect(screen.getByText("W1")).toBeInTheDocument();
    expect(screen.getAllByText("59-23")).toHaveLength(2);
  });

  it("caps each ladder at the seed limit", () => {
    render(
      <HomeStandingsPanel
        standings={{
          east: ladder({ conference: "East", size: 15 }),
          west: ladder({ conference: "West", size: 15 }),
        }}
      />,
    );
    expect(screen.getByText(`E${HOME_STANDINGS_LIMIT}`)).toBeInTheDocument();
    expect(screen.queryByText(`E${HOME_STANDINGS_LIMIT + 1}`)).not.toBeInTheDocument();
  });

  it("spells out each team's full name for the abbreviation", () => {
    render(
      <HomeStandingsPanel
        standings={{ east: ladder({ conference: "East", size: 1 }), west: [] }}
      />,
    );
    expect(screen.getByText("E1")).toHaveAttribute("title", "East Team 1");
  });

  it("explains an unavailable ladder instead of rendering empty lists", () => {
    render(<HomeStandingsPanel standings={null} />);
    expect(screen.getByText(/Standings are unavailable/)).toBeInTheDocument();
  });
});

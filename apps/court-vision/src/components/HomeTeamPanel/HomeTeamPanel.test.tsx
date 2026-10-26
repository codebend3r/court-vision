import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@vision/sport-basketball/engine";
import { teamNameToSlug } from "@vision/core/roster/slug";
import { type FantasyTeam, type FantasyTeamPlayer } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

type TeamProps = {
  id: string;
  name: string;
  createdAt: string;
  slug?: string;
  isImported?: boolean;
};

const team = ({ id, name, createdAt, slug, isImported = false }: TeamProps): FantasyTeam => ({
  id,
  name,
  slug: slug ?? teamNameToSlug({ name }),
  logoUrl: null,
  managerName: null,
  isMine: false,
  isImported,
  unmatchedBySlotId: {},
  createdAt,
  slots: buildSlots<FantasyTeamPlayer>({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
    slot.id === "PG-1"
      ? {
          ...slot,
          player: {
            playerId: 1,
            firstName: "Jalen",
            lastName: "Brunson",
            fullName: "Jalen Brunson",
            teamAbbr: "NYK",
            position: "G",
            nbaPersonId: null,
          },
        }
      : slot,
  ),
});

describe("HomeTeamPanel", () => {
  it("prompts to create a team when there are none", () => {
    render(<HomeTeamPanel team={null} isImported={false} />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("shows the team's starters and how full its roster is", () => {
    render(
      <HomeTeamPanel
        isImported={false}
        team={team({ id: "b", name: "Second Unit", createdAt: "2026-07-25T00:00:00.000Z" })}
      />,
    );
    expect(screen.getByRole("link", { name: "Second Unit" })).toHaveAttribute(
      "href",
      "/my-teams/second-unit",
    );
    expect(screen.getByText("1/15 slots filled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jalen Brunson" })).toHaveAttribute(
      "href",
      "/players/1",
    );
  });

  it("links a renamed team to its stable DB slug, not one recomputed from the new name", () => {
    render(
      <HomeTeamPanel
        isImported={false}
        team={team({ id: "a", name: "Beta", createdAt: "2026-07-20T00:00:00.000Z", slug: "alpha" })}
      />,
    );
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute("href", "/my-teams/alpha");
  });

  it("applies the layout className to the panel", () => {
    const { container } = render(
      <HomeTeamPanel team={null} isImported={false} className="panel-card" />,
    );
    expect(container.querySelector(".panel-card")).toBeInTheDocument();
  });

  it("links an imported team to the read-only My teams list", () => {
    render(
      <HomeTeamPanel
        isImported
        team={team({
          id: "a",
          name: "Better Call Gasol",
          createdAt: "2026-07-20T00:00:00.000Z",
          isImported: true,
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "Better Call Gasol" })).toHaveAttribute(
      "href",
      "/my-teams",
    );
  });

  it("offers no team builder for an imported league with no teams", () => {
    render(<HomeTeamPanel team={null} isImported />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "create your first team" })).not.toBeInTheDocument();
  });
});

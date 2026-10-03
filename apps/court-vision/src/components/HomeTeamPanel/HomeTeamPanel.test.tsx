import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { HomeTeamPanel } from "@/components/HomeTeamPanel/HomeTeamPanel";
import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { teamNameToSlug } from "@/lib/fantasyTeams/slug";
import { type FantasyTeam } from "@/lib/fantasyTeams/types";

afterEach(cleanup);

const team = ({
  id,
  name,
  createdAt,
  slug,
}: {
  id: string;
  name: string;
  createdAt: string;
  slug?: string;
}): FantasyTeam => ({
  id,
  name,
  slug: slug ?? teamNameToSlug(name),
  createdAt,
  slots: buildSlots({ counts: DEFAULT_SLOT_COUNTS }).map((slot) =>
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
    render(<HomeTeamPanel teams={[]} />);
    expect(screen.getByText(/No fantasy teams yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "create your first team" })).toHaveAttribute(
      "href",
      "/my-teams/create",
    );
  });

  it("shows the most recently created team's starters", () => {
    render(
      <HomeTeamPanel
        teams={[
          team({ id: "a", name: "Bench Mob", createdAt: "2026-07-20T00:00:00.000Z" }),
          team({ id: "b", name: "Second Unit", createdAt: "2026-07-25T00:00:00.000Z" }),
        ]}
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
        teams={[
          team({ id: "a", name: "Beta", createdAt: "2026-07-20T00:00:00.000Z", slug: "alpha" }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute("href", "/my-teams/alpha");
  });

  it("applies the layout className to the panel", () => {
    const { container } = render(<HomeTeamPanel teams={[]} className="panel-card" />);
    expect(container.querySelector(".panel-card")).toBeInTheDocument();
  });
});

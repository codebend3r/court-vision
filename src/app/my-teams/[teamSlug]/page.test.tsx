import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { buildSlots, DEFAULT_SLOT_COUNTS } from "@/lib/fantasyTeams/slots";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { makeStatLine } from "@/lib/valuation/fixtures";

import EditTeamPage from "@/app/my-teams/[teamSlug]/page";

const getFantasyPool = vi.fn();

vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useFantasyTeamsStore.setState({ teams: [] });
  getFantasyPool.mockResolvedValue([makeStatLine({ playerId: 1 })]);
});

afterEach(cleanup);

describe("EditTeamPage", () => {
  it("loads the stored team by slug into the builder", async () => {
    useFantasyTeamsStore.setState({
      teams: [
        {
          id: "team-1",
          name: "Bench Mob",
          createdAt: "2026-07-23T00:00:00.000Z",
          slots: buildSlots({ counts: DEFAULT_SLOT_COUNTS }),
        },
      ],
    });

    render(await EditTeamPage({ params: Promise.resolve({ teamSlug: "bench-mob" }) }));

    expect(screen.getByRole("heading", { name: "Bench Mob" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Team name")).toHaveValue("Bench Mob");
    expect(screen.getByLabelText("Search players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← My Teams" })).toHaveAttribute("href", "/my-teams");
  });

  it("notices unknown slugs", async () => {
    render(await EditTeamPage({ params: Promise.resolve({ teamSlug: "ghost-squad" }) }));

    expect(await screen.findByText(/No team matches/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My Teams" })).toHaveAttribute(
      "href",
      "/my-teams",
    );
  });
});

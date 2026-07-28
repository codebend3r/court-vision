import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { makeStatLine } from "@/lib/valuation/fixtures";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";

import CreateTeamPage from "@/app/my-teams/create/page";

const getFantasyPool = vi.fn();

vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useFantasyTeamsStore.setState({ teams: [] });
  getFantasyPool.mockResolvedValue([makeStatLine({ playerId: 1 })]);
});

afterEach(cleanup);

describe("CreateTeamPage", () => {
  it("renders the builder over the cached player pool", async () => {
    render(await CreateTeamPage());
    expect(screen.getByRole("heading", { name: "Create team" })).toBeInTheDocument();
    expect(getFantasyPool).toHaveBeenCalledWith({ range: "all" });
    expect(screen.getByLabelText("Team name")).toBeInTheDocument();
    expect(screen.getByLabelText("Search players")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← My Teams" })).toHaveAttribute("href", "/my-teams");
  });
});

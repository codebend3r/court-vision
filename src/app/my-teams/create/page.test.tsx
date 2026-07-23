import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateTeamPage from "@/app/my-teams/create/page";
import { useFantasyTeamsStore } from "@/lib/fantasyTeams/store";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { getFantasyPool } from "@/lib/valuation/loader";

vi.mock("@/lib/valuation/loader", () => ({
  getFantasyPool: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useFantasyTeamsStore.setState({ teams: [] });
  vi.mocked(getFantasyPool).mockResolvedValue([makeStatLine({ playerId: 1 })]);
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

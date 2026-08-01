import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { LeagueForm } from "@/components/LeagueForm/LeagueForm";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";
import { CATEGORY_KEYS } from "@/lib/valuation/categories";
import { DEFAULT_POINTS_SCORING } from "@/lib/valuation/methods/points";

const createLeagueMock = vi.fn();
const updateLeagueMock = vi.fn();

vi.mock("@/lib/leagues/actions", () => ({
  createLeague: (args: unknown) => createLeagueMock(args),
  updateLeague: (args: unknown) => updateLeagueMock(args),
}));

const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const league: LeagueSummary = {
  id: "league-1",
  name: "My League",
  slug: "my-league",
  scoringType: "h2h_categories",
  teamCount: 10,
  rosterSlots: 12,
  scoringConfig: { categories: ["pts", "reb", "ast"], weights: { pts: 1.5 } },
  createdAt: "2026-07-31T00:00:00.000Z",
};

beforeEach(() => {
  createLeagueMock.mockReset();
  updateLeagueMock.mockReset();
  refreshMock.mockClear();
  pushMock.mockClear();
  useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
});

afterEach(cleanup);

describe("LeagueForm", () => {
  it("renders create-mode defaults", () => {
    render(<LeagueForm league={null} />);
    expect(screen.getByLabelText("League name")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "H2H Categories" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "H2H Points" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rotisserie" })).toBeInTheDocument();
    expect(screen.getByLabelText("Teams")).toHaveValue(12);
    expect(screen.getByLabelText("Roster slots")).toHaveValue(13);
    expect(screen.getByRole("checkbox", { name: "PTS" })).toBeChecked();
  });

  it("swaps category checkboxes for the scoring table when H2H Points is selected", () => {
    render(<LeagueForm league={null} />);
    expect(screen.getByRole("checkbox", { name: "PTS" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "H2H Points" }));

    expect(screen.queryByRole("checkbox", { name: "PTS" })).not.toBeInTheDocument();
    ["PTS", "REB", "AST", "STL", "BLK", "3PM", "TOV"].forEach((label) => {
      expect(screen.getByRole("spinbutton", { name: label })).toBeInTheDocument();
    });
  });

  it("shows categories without weight inputs when Rotisserie is selected", () => {
    render(<LeagueForm league={null} />);

    fireEvent.click(screen.getByRole("radio", { name: "Rotisserie" }));

    expect(screen.getByRole("checkbox", { name: "PTS" })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "PTS weight" })).not.toBeInTheDocument();
  });

  it("keeps at least one category checked and disables its weight input when unchecked", () => {
    render(<LeagueForm league={null} />);
    const toUncheck = ["PTS", "REB", "AST", "STL", "BLK", "3PM", "TOV", "FG%"];
    toUncheck.forEach((label) => {
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
    });

    const lastCheckbox = screen.getByRole("checkbox", { name: "FT%" });
    expect(lastCheckbox).toBeChecked();
    expect(lastCheckbox).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "PTS weight" })).toBeDisabled();
  });

  it("submits createLeague with an h2h_points scoring config", async () => {
    createLeagueMock.mockResolvedValue({
      status: "ok",
      league: {
        ...league,
        id: "new-league",
        scoringType: "h2h_points",
        scoringConfig: { scoring: DEFAULT_POINTS_SCORING },
      },
    });
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Dynasty" } });
    fireEvent.click(screen.getByRole("radio", { name: "H2H Points" }));
    const form = screen.getByRole("button", { name: "Create league" }).closest("form");
    if (form === null) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => expect(createLeagueMock).toHaveBeenCalled());
    expect(createLeagueMock).toHaveBeenCalledWith({
      name: "Dynasty",
      scoringType: "h2h_points",
      teamCount: 12,
      rosterSlots: 13,
      scoringConfig: { scoring: DEFAULT_POINTS_SCORING },
    });
    expect(useLeaguesStore.getState().leagues).toHaveLength(1);
    expect(pushMock).toHaveBeenCalledWith("/leagues");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("submits createLeague with an h2h_categories config keeping only non-default weights", async () => {
    createLeagueMock.mockResolvedValue({ status: "ok", league });
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), {
      target: { value: "Categories League" },
    });
    const ptsWeight = screen.getByRole("spinbutton", { name: "PTS weight" });
    fireEvent.change(ptsWeight, { target: { value: "1.5" } });
    fireEvent.blur(ptsWeight);
    const rebWeight = screen.getByRole("spinbutton", { name: "REB weight" });
    fireEvent.change(rebWeight, { target: { value: "1" } });
    fireEvent.blur(rebWeight);

    const form = screen.getByRole("button", { name: "Create league" }).closest("form");
    if (form === null) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => expect(createLeagueMock).toHaveBeenCalled());
    expect(createLeagueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scoringConfig: { categories: [...CATEGORY_KEYS], weights: { pts: 1.5 } },
      }),
    );
  });

  it("submits createLeague with a roto config that has no weights key", async () => {
    createLeagueMock.mockResolvedValue({ status: "ok", league });
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Roto League" } });
    fireEvent.click(screen.getByRole("radio", { name: "Rotisserie" }));

    const form = screen.getByRole("button", { name: "Create league" }).closest("form");
    if (form === null) throw new Error("form not found");
    fireEvent.submit(form);

    await waitFor(() => expect(createLeagueMock).toHaveBeenCalled());
    const call: { scoringConfig: unknown } = createLeagueMock.mock.calls[0][0];
    expect(call.scoringConfig).toEqual({ categories: [...CATEGORY_KEYS] });
    expect(call.scoringConfig).not.toHaveProperty("weights");
  });

  it("captures a typed teams value at submit time even when blur never fires (Enter-submit race)", async () => {
    createLeagueMock.mockResolvedValue({ status: "ok", league });
    const user = userEvent.setup();
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Enter League" } });
    const teamsInput = screen.getByLabelText("Teams");
    await user.clear(teamsInput);
    await user.type(teamsInput, "8");
    await user.type(teamsInput, "{Enter}");

    await waitFor(() => expect(createLeagueMock).toHaveBeenCalled());
    expect(createLeagueMock).toHaveBeenCalledWith(expect.objectContaining({ teamCount: 8 }));
  });

  it("pre-fills fields in edit mode and submits updateLeague with the full scoring config", async () => {
    updateLeagueMock.mockResolvedValue({ status: "ok", league });
    const user = userEvent.setup();
    render(<LeagueForm league={league} />);

    expect(screen.getByLabelText("League name")).toHaveValue("My League");
    expect(screen.getByRole("radio", { name: "H2H Categories" })).toBeChecked();
    expect(screen.getByLabelText("Teams")).toHaveValue(10);
    expect(screen.getByLabelText("Roster slots")).toHaveValue(12);
    expect(screen.getByRole("spinbutton", { name: "PTS weight" })).toHaveValue(1.5);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateLeagueMock).toHaveBeenCalled());
    expect(updateLeagueMock).toHaveBeenCalledWith({
      leagueId: "league-1",
      name: "My League",
      scoringType: "h2h_categories",
      teamCount: 10,
      rosterSlots: 12,
      scoringConfig: { categories: ["pts", "reb", "ast"], weights: { pts: 1.5 } },
    });
    expect(pushMock).toHaveBeenCalledWith("/leagues");
  });

  it("renders the limit error copy in a role=alert region", async () => {
    createLeagueMock.mockResolvedValue({ status: "limit" });
    const user = userEvent.setup();
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Overflow" } });
    await user.click(screen.getByRole("button", { name: "Create league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You already have 10 leagues.");
  });

  it("renders the invalid error copy for an invalid result", async () => {
    createLeagueMock.mockResolvedValue({ status: "invalid" });
    const user = userEvent.setup();
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Bad" } });
    await user.click(screen.getByRole("button", { name: "Create league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the league name and settings.",
    );
  });

  it("renders the generic error copy for any other failure", async () => {
    createLeagueMock.mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    render(<LeagueForm league={null} />);

    fireEvent.change(screen.getByLabelText("League name"), { target: { value: "Broken" } });
    await user.click(screen.getByRole("button", { name: "Create league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong — try again.");
  });
});

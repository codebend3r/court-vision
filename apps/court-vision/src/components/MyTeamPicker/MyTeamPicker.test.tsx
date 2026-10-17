import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type FantasyTeam } from "@/lib/fantasyTeams/types";

const setMyTeam = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/lib/yahoo/actions", () => ({
  setMyTeam: (args: { leagueId: string; teamId: string }) => setMyTeam(args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { MyTeamPicker } from "@/components/MyTeamPicker/MyTeamPicker";
import { MAIN_CONTENT_ID } from "@vision/ui/components/SkipLink/SkipLink";

const team = ({ id, name }: { id: string; name: string }): FantasyTeam => ({
  id,
  name,
  slug: name.toLowerCase(),
  slots: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  logoUrl: null,
  managerName: null,
  isMine: false,
  isImported: true,
  unmatchedBySlotId: {},
});

const teams = [
  team({ id: "team-1", name: "Bench Mob" }),
  team({ id: "team-5", name: "Newfoundlanders" }),
];

beforeEach(() => {
  setMyTeam.mockReset().mockResolvedValue({ status: "ok" });
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("MyTeamPicker", () => {
  it("lists the league's teams in a labelled select beside a Save keycap", () => {
    render(<MyTeamPicker leagueId="league-1" teams={teams} />);

    const select = screen.getByRole("combobox", { name: "Your team" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Bench Mob",
      "Newfoundlanders",
    ]);
    expect(select).toHaveValue("team-1");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("save");
  });

  it("saves the picked team and refreshes the page", async () => {
    const user = userEvent.setup();
    render(<MyTeamPicker leagueId="league-1" teams={teams} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Your team" }), "team-5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(setMyTeam).toHaveBeenCalledWith({ leagueId: "league-1", teamId: "team-5" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the save and moves focus to the main content after the refresh", async () => {
    const user = userEvent.setup();
    // The layout's focusable wrapper around every route.
    render(
      <div id={MAIN_CONTENT_ID} tabIndex={-1}>
        <MyTeamPicker leagueId="league-1" teams={teams} />
      </div>,
    );
    const main = document.getElementById(MAIN_CONTENT_ID);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(main).toHaveFocus());
    expect(refreshMock).toHaveBeenCalled();
    expect(status).toHaveTextContent("Team saved.");
  });

  it("announces a save the server refused", async () => {
    setMyTeam.mockResolvedValue({ status: "invalid" });
    const user = userEvent.setup();
    render(<MyTeamPicker leagueId="league-1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save your team. Try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("announces a save that throws", async () => {
    setMyTeam.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<MyTeamPicker leagueId="league-1" teams={teams} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save your team. Try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

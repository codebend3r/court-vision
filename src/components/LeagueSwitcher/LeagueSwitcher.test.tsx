import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { LeagueSwitcher } from "@/components/LeagueSwitcher/LeagueSwitcher";
import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";

const setActiveLeagueMock = vi.fn(async (_args: { leagueId: string }) => ({ status: "ok" }));

vi.mock("@/lib/leagues/actions", () => ({
  setActiveLeague: (args: { leagueId: string }) => setActiveLeagueMock(args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const league = ({ id, name }: { id: string; name: string }): LeagueSummary => ({
  id,
  name,
  slug: name.toLowerCase(),
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  createdAt: "2026-07-31T00:00:00.000Z",
});

beforeEach(() => {
  setActiveLeagueMock.mockClear();
  useLeaguesStore.setState({
    leagues: [league({ id: "a", name: "Alpha" }), league({ id: "b", name: "Beta" })],
    activeLeagueId: "a",
  });
});

afterEach(cleanup);

describe("LeagueSwitcher", () => {
  it("shows the active league name", () => {
    render(<LeagueSwitcher />);
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("renders nothing with no leagues", () => {
    useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
    const { container } = render(<LeagueSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it("switches league optimistically and calls the action", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Beta/ }));
    expect(useLeaguesStore.getState().activeLeagueId).toBe("b");
    expect(setActiveLeagueMock).toHaveBeenCalledWith({ leagueId: "b" });
  });

  it("closes on Escape and restores focus to the trigger", () => {
    render(<LeagueSwitcher />);
    const trigger = screen.getByRole("button", { name: /Alpha/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when a pointerdown happens outside the switcher", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves focus to the next item on ArrowDown", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    const alphaOption = screen.getByRole("menuitemradio", { name: /Alpha/ });
    const betaOption = screen.getByRole("menuitemradio", { name: /Beta/ });
    expect(document.activeElement).toBe(alphaOption);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(betaOption);
  });

  it("wraps focus to the last item on ArrowUp from the first item", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    const alphaOption = screen.getByRole("menuitemradio", { name: /Alpha/ });
    const manageLink = screen.getByRole("menuitem", { name: "Manage leagues" });
    expect(document.activeElement).toBe(alphaOption);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(manageLink);
  });

  it("jumps to the last item on End and back to the first on Home", () => {
    render(<LeagueSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    const alphaOption = screen.getByRole("menuitemradio", { name: /Alpha/ });
    const manageLink = screen.getByRole("menuitem", { name: "Manage leagues" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(document.activeElement).toBe(manageLink);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(document.activeElement).toBe(alphaOption);
  });

  it("closes without restoring focus when Tab moves focus out of the switcher", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <LeagueSwitcher />
        <button type="button">After</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});

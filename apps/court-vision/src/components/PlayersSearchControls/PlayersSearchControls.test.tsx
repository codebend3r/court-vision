import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ReactNode, use, useEffect, useState } from "react";

import {
  PlayersSearchControls,
  type PlayersSearchControlsProps,
} from "@/components/PlayersSearchControls/PlayersSearchControls";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { type AdvancedSearchParams, type RegularSearchParams } from "@/lib/players/searchParams";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(cleanup);

beforeEach(() => {
  replace.mockReset();
  vi.useFakeTimers();
});

// A server render that never lands. Suspending on it inside the transition that
// called `replace` holds that transition pending, the way a cold /players query
// does, so the optimistic state is observable before the new props arrive.
const unresolvedNavigation = new Promise<never>(() => {});

function AwaitNavigation() {
  use(unresolvedNavigation);
  return null;
}

type PendingNavigationProps = { children: ReactNode };

function PendingNavigation({ children }: PendingNavigationProps) {
  const [hasNavigated, setHasNavigated] = useState(false);
  useEffect(() => {
    replace.mockImplementation(() => setHasNavigated(true));
  }, []);
  return (
    <>
      {children}
      {hasNavigated && <AwaitNavigation />}
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  useRosteredStore.setState({ owners: null });
});

const regularParams: RegularSearchParams = {
  q: "",
  page: 1,
  size: 50,
  sort: "pts",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  owner: "all",
  tab: "regular",
};

const advancedParams: AdvancedSearchParams = { ...regularParams, tab: "advanced", sort: "pie" };

const controlsProps = (params: Partial<RegularSearchParams> = {}): PlayersSearchControlsProps => ({
  params: { ...regularParams, ...params },
});

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("PlayersSearchControls", () => {
  it("debounces rapid keystrokes into a single navigation after 300ms", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "cu" } });
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?q=cur");
  });

  it("does not navigate at 299ms but fires on the next millisecond", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    advance(299);
    expect(replace).toHaveBeenCalledTimes(0);

    advance(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when the trimmed value equals the current q", () => {
    render(<PlayersSearchControls {...controlsProps({ q: "cur" })} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("changes the game range and stat display while preserving the other filter", () => {
    const { rerender } = render(<PlayersSearchControls {...controlsProps({ mode: "total" })} />);

    fireEvent.change(screen.getByLabelText("Game range"), { target: { value: "last20" } });
    expect(replace).toHaveBeenLastCalledWith("/players?range=last20&mode=total");

    rerender(<PlayersSearchControls {...controlsProps({ range: "last20" })} />);
    fireEvent.change(screen.getByLabelText("Stat display"), { target: { value: "total" } });
    expect(replace).toHaveBeenLastCalledWith("/players?range=last20&mode=total");
  });

  it("writes the roster-status quick filter to the URL, keeping the other filters", () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners: [] });
    render(<PlayersSearchControls {...controlsProps({ mode: "total" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Free agents" }));
    expect(replace).toHaveBeenLastCalledWith("/players?mode=total&owner=free");

    fireEvent.click(screen.getByRole("button", { name: "Taken" }));
    expect(replace).toHaveBeenLastCalledWith("/players?mode=total&owner=taken");
  });

  it("marks the active quick filter pressed and omits it when rosters are unknown", () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners: [] });
    const { unmount } = render(<PlayersSearchControls {...controlsProps({ owner: "taken" })} />);

    expect(screen.getByRole("button", { name: "Taken" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All players" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    unmount();
    useRosteredStore.setState({ owners: null });
    render(<PlayersSearchControls {...controlsProps()} />);
    expect(screen.queryByRole("group", { name: "Roster status" })).toBeNull();
  });

  it("writes minimums=0 to the URL when qualifying minimums is turned off", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Off" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?minimums=0");
  });

  it("clears the minimums param when turned back on", () => {
    render(<PlayersSearchControls {...controlsProps({ minimums: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "On" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players");
  });

  it("marks the active minimums keycap pressed", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cancels a pending debounce timer on unmount", () => {
    const { unmount } = render(<PlayersSearchControls {...controlsProps()} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    unmount();
    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("skips navigation when q catches up while the timer is pending", () => {
    const { rerender } = render(<PlayersSearchControls {...controlsProps()} />);

    const input = screen.getByLabelText("Search players");
    // Fire change event to "cur" — debounce timer now pending. Do NOT advance yet.
    fireEvent.change(input, { target: { value: "cur" } });

    // Rerender with q="cur" (props catch up) while the timer is still pending.
    // This updates latestQ.current to "cur" via the useEffect.
    rerender(<PlayersSearchControls {...controlsProps({ q: "cur" })} />);

    // Now advance the timer. The callback should check latestQ.current === "cur"
    // and skip navigation. Under the old buggy code (using stale closure q=""),
    // it would incorrectly navigate.
    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("cancels pending debounce timer on immediate navigation (game range)", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    const input = screen.getByLabelText("Search players");
    const select = screen.getByLabelText("Game range");

    // Type "cur" — debounce timer is pending.
    fireEvent.change(input, { target: { value: "cur" } });

    // Immediately change the range (before timer fires). This cancels the pending timer.
    fireEvent.change(select, { target: { value: "last20" } });

    // Advance 300ms. The pending debounce should have been cancelled,
    // so replace should be called exactly ONCE (the range navigation).
    advance(300);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?range=last20");
  });

  it("shows the stat display select and minimums keycaps on the regular tab", () => {
    render(<PlayersSearchControls {...controlsProps({ tab: "regular" })} />);

    expect(screen.getByLabelText("Stat display")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Qualifying minimums" })).toBeInTheDocument();
  });

  it("hides the stat display select and qualifying minimums keycaps on the advanced tab", () => {
    render(<PlayersSearchControls params={advancedParams} />);

    expect(screen.queryByLabelText("Stat display")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Qualifying minimums" })).not.toBeInTheDocument();
  });

  it("includes the tab in the search navigation href", () => {
    render(<PlayersSearchControls params={advancedParams} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });
    advance(300);

    expect(replace).toHaveBeenLastCalledWith("/players?q=cur&tab=advanced");
  });

  describe("while the navigation is pending", () => {
    // No debounce here, and an awaited act() settles on real timers. Awaiting it
    // is what React asks for when a render suspends inside the act scope.
    beforeEach(() => {
      vi.useRealTimers();
    });

    const renderPending = (props: Partial<RegularSearchParams> = {}) =>
      render(
        <PendingNavigation>
          <PlayersSearchControls {...controlsProps(props)} />
        </PendingNavigation>,
      );

    type ChangeSelectProps = { label: string; value: string };

    const changeSelect = async ({ label, value }: ChangeSelectProps) => {
      await act(async () => {
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      });
    };

    it("shows the chosen game range instead of snapping back to the old one", async () => {
      renderPending();

      await changeSelect({ label: "Game range", value: "last20" });

      expect(replace).toHaveBeenCalledWith("/players?range=last20");
      expect(screen.getByLabelText("Game range")).toHaveValue("last20");
    });

    it("shows the chosen stat display immediately", async () => {
      renderPending();

      await changeSelect({ label: "Stat display", value: "total" });

      expect(screen.getByLabelText("Stat display")).toHaveValue("total");
    });

    it("presses the chosen minimums keycap immediately", async () => {
      renderPending();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Off" }));
      });

      expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "false");
    });

    it("keeps the earlier choice when a second filter changes before the first lands", async () => {
      renderPending();

      await changeSelect({ label: "Game range", value: "last20" });
      await changeSelect({ label: "Stat display", value: "total" });

      expect(replace).toHaveBeenLastCalledWith("/players?range=last20&mode=total");
      expect(screen.getByLabelText("Game range")).toHaveValue("last20");
      expect(screen.getByLabelText("Stat display")).toHaveValue("total");
    });

    it("keeps the pending dim and announces the update", async () => {
      renderPending();

      await changeSelect({ label: "Game range", value: "last20" });

      const controls = screen.getByLabelText("Game range").closest("section");
      expect(controls).toHaveAttribute("data-pending", "true");
      expect(controls).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("status")).toHaveTextContent("Updating players…");
    });
  });

  it("leaves the status region empty when nothing is pending", () => {
    render(<PlayersSearchControls {...controlsProps()} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

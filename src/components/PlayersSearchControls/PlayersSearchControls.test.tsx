import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlayersSearchControls,
  type PlayersSearchControlsProps,
} from "@/components/PlayersSearchControls/PlayersSearchControls";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(cleanup);

beforeEach(() => {
  replace.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const defaultProps: PlayersSearchControlsProps = {
  q: "",
  size: 50,
  sort: "pts",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("PlayersSearchControls", () => {
  it("debounces rapid keystrokes into a single navigation after 300ms", () => {
    render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "cu" } });
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?q=cur");
  });

  it("does not navigate at 299ms but fires on the next millisecond", () => {
    render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    advance(299);
    expect(replace).toHaveBeenCalledTimes(0);

    advance(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when the trimmed value equals the current q", () => {
    render(<PlayersSearchControls {...defaultProps} q="cur" />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("changes the game range and stat display while preserving the other filter", () => {
    const { rerender } = render(<PlayersSearchControls {...defaultProps} mode="total" />);

    fireEvent.change(screen.getByLabelText("Game range"), { target: { value: "last20" } });
    expect(replace).toHaveBeenLastCalledWith("/players?range=last20&mode=total");

    rerender(<PlayersSearchControls {...defaultProps} range="last20" />);
    fireEvent.change(screen.getByLabelText("Stat display"), { target: { value: "total" } });
    expect(replace).toHaveBeenLastCalledWith("/players?range=last20&mode=total");
  });

  it("writes minimums=0 to the URL when the qualifying minimums switch is turned off", () => {
    render(<PlayersSearchControls {...defaultProps} />);

    fireEvent.click(screen.getByRole("switch", { name: "Qualifying minimums" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?minimums=0");
  });

  it("clears the minimums param when the switch is turned back on", () => {
    render(<PlayersSearchControls {...defaultProps} minimums={false} />);

    fireEvent.click(screen.getByRole("switch", { name: "Qualifying minimums" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players");
  });

  it("cancels a pending debounce timer on unmount", () => {
    const { unmount } = render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    unmount();
    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("skips navigation when q catches up while the timer is pending", () => {
    const { rerender } = render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    // Fire change event to "cur" — debounce timer now pending. Do NOT advance yet.
    fireEvent.change(input, { target: { value: "cur" } });

    // Rerender with q="cur" (props catch up) while the timer is still pending.
    // This updates latestQ.current to "cur" via the useEffect.
    rerender(<PlayersSearchControls {...defaultProps} q="cur" />);

    // Now advance the timer. The callback should check latestQ.current === "cur"
    // and skip navigation. Under the old buggy code (using stale closure q=""),
    // it would incorrectly navigate.
    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });

  it("cancels pending debounce timer on immediate navigation (game range)", () => {
    render(<PlayersSearchControls {...defaultProps} />);

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
});

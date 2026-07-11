import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayersSearchControls, type PlayersSearchControlsProps } from "./PlayersSearchControls";

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
  page: 1,
  size: 25,
  includeRetired: false,
  totalPages: 1,
  sort: "firstName",
  dir: "asc",
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

  it("navigates immediately on size change, resetting page to 1", () => {
    render(<PlayersSearchControls {...defaultProps} page={3} />);

    const select = screen.getByLabelText("Page size");
    fireEvent.change(select, { target: { value: "50" } });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?size=50");
  });

  it("navigates immediately on retired toggle, preserving q and size", () => {
    render(<PlayersSearchControls {...defaultProps} q="cur" size={50} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?q=cur&size=50&retired=1");
  });

  it("navigates to the next page, preserving size", () => {
    render(<PlayersSearchControls {...defaultProps} page={2} size={50} totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?page=3&size=50");
  });

  it("preserves a non-default sort and dir on navigation", () => {
    render(<PlayersSearchControls {...defaultProps} sort="lastName" dir="desc" totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?page=2&sort=lastName&dir=desc");
  });

  it("disables the Previous button on the first page", () => {
    render(<PlayersSearchControls {...defaultProps} page={1} totalPages={3} />);

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables the Next button on the last page", () => {
    render(<PlayersSearchControls {...defaultProps} page={3} totalPages={3} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
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

  it("cancels pending debounce timer on immediate navigation (size, retired, pager)", () => {
    render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    const select = screen.getByLabelText("Page size");

    // Type "cur" — debounce timer is pending.
    fireEvent.change(input, { target: { value: "cur" } });

    // Immediately change size (before timer fires). This should cancel the pending timer.
    fireEvent.change(select, { target: { value: "50" } });

    // Advance 300ms. The pending debounce should have been cancelled,
    // so replace should be called exactly ONCE (the size navigation).
    advance(300);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?size=50");
  });
});

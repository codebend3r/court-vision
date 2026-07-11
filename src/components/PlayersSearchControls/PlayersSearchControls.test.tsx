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

  it("does not navigate when props catch up and user types the same value again", () => {
    const { rerender } = render(<PlayersSearchControls {...defaultProps} />);

    const input = screen.getByLabelText("Search players");
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/players?q=cur");

    replace.mockClear();

    rerender(<PlayersSearchControls {...defaultProps} q="cur" />);
    fireEvent.change(input, { target: { value: "cur" } });

    advance(300);

    expect(replace).toHaveBeenCalledTimes(0);
  });
});

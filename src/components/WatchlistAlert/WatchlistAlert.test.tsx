import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { WatchlistAlert } from "@/components/WatchlistAlert/WatchlistAlert";
import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

afterEach(cleanup);

describe("WatchlistAlert", () => {
  it("renders nothing when there is no error", () => {
    render(<WatchlistAlert />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces the cap message with the live count", () => {
    useWatchlistStore.setState({ lastError: "limit", count: 50 });
    render(<WatchlistAlert />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Watchlist full (50/50) — unstar someone first.",
    );
  });

  it("announces a sign-in prompt when unauthenticated", () => {
    useWatchlistStore.setState({ lastError: "unauthenticated" });
    render(<WatchlistAlert />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to star players.");
  });

  it("falls back to a retry message for unknown failures", () => {
    useWatchlistStore.setState({ lastError: "error" });
    render(<WatchlistAlert />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't update your watchlist.");
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const starPlayer = vi.fn();
const unstarPlayer = vi.fn();

vi.mock("@/lib/watchlist/actions", () => ({ starPlayer, unstarPlayer }));
vi.mock("next/navigation", () => ({ usePathname: () => "/players" }));

import { StarButton } from "@/components/StarButton/StarButton";
import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  starPlayer.mockReset();
  unstarPlayer.mockReset();
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

afterEach(cleanup);

describe("StarButton", () => {
  it("labels an unstarred player and reports aria-pressed=false", () => {
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    expect(screen.getByRole("button", { name: "Star Jalen Brunson" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("flips optimistically before the action resolves", async () => {
    starPlayer.mockReturnValue(new Promise(() => {}));
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    await userEvent.click(screen.getByRole("button"));
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
  });

  it("keeps the star and records the server count on success", async () => {
    starPlayer.mockResolvedValue({ status: "ok", count: 1 });
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(useWatchlistStore.getState().count).toBe(1));
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(true);
    expect(useWatchlistStore.getState().lastError).toBeNull();
  });

  it("rolls back and records the error when the cap is hit", async () => {
    starPlayer.mockResolvedValue({ status: "limit", count: 50 });
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(useWatchlistStore.getState().lastError).toBe("limit"));
    expect(useWatchlistStore.getState().playerIds.has(7)).toBe(false);
    expect(useWatchlistStore.getState().count).toBe(50);
  });

  it("unstars a starred player", async () => {
    unstarPlayer.mockResolvedValue({ status: "ok", count: 0 });
    useWatchlistStore.setState({ playerIds: new Set([7]), count: 1, lastError: null });
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn />);
    const button = screen.getByRole("button", { name: "Unstar Jalen Brunson" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(button);
    await waitFor(() => expect(useWatchlistStore.getState().playerIds.has(7)).toBe(false));
  });

  it("renders a sign-in link instead of a button when signed out", () => {
    render(<StarButton playerId={7} fullName="Jalen Brunson" isSignedIn={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to star Jalen Brunson" })).toHaveAttribute(
      "href",
      "/login?next=%2Fplayers",
    );
  });
});

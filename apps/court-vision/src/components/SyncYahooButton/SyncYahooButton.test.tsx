import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type YahooSyncResult } from "@/lib/yahoo/types";

const syncYahooLeagueMock = vi.fn<(args: { leagueId: string }) => Promise<YahooSyncResult>>();

vi.mock("@/lib/yahoo/actions", () => ({
  syncYahooLeague: (args: { leagueId: string }) => syncYahooLeagueMock(args),
}));

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

import { SyncYahooButton } from "@/components/SyncYahooButton/SyncYahooButton";

beforeEach(() => {
  syncYahooLeagueMock.mockReset();
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("SyncYahooButton", () => {
  it("shows syncing, then refreshes", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<YahooSyncResult>();
    syncYahooLeagueMock.mockReturnValue(pending.promise);
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);

    expect(screen.getByRole("status")).toHaveTextContent("Never synced");
    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: "league-1" });
    const button = screen.getByRole("button", { name: "Syncing…" });
    expect(button).toHaveAttribute("aria-disabled", "true");

    // A second press while pending does nothing.
    await user.click(button);
    expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);

    pending.resolve({ status: "ok", syncedAt: new Date().toISOString(), unmatched: [] });

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Synced just now"));
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("keeps focus on the button through a sync", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<YahooSyncResult>();
    syncYahooLeagueMock.mockReturnValue(pending.promise);
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);

    const button = screen.getByRole("button", { name: "Sync with Yahoo" });
    await user.click(button);
    expect(button).toHaveFocus();

    pending.resolve({ status: "ok", syncedAt: new Date().toISOString(), unmatched: [] });

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toHaveFocus();
  });

  it("re-announces a failure that repeats", async () => {
    const user = userEvent.setup();
    const failure = "Yahoo isn't answering right now; try again in a minute.";
    syncYahooLeagueMock.mockResolvedValueOnce({ status: "unavailable" });
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);
    const status = screen.getByRole("status");

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));
    await waitFor(() => expect(status).toHaveTextContent(failure));

    const second = Promise.withResolvers<YahooSyncResult>();
    syncYahooLeagueMock.mockReturnValueOnce(second.promise);
    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));
    // The old message clears while the retry runs, so the repeat is news.
    await waitFor(() => expect(status).not.toHaveTextContent(failure));

    second.resolve({ status: "unavailable" });
    await waitFor(() => expect(status).toHaveTextContent(failure));
  });

  it("names its league when given one", () => {
    render(
      <SyncYahooButton
        leagueId="league-1"
        leagueName="Game of Courts"
        syncedAt={null}
        syncError={null}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sync with Yahoo: Game of Courts" }),
    ).toHaveTextContent("Sync with Yahoo");
  });

  it("announces a sync failure", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(status).toHaveTextContent("Yahoo isn't answering right now; try again in a minute."),
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toBeEnabled();
  });

  it("announces a sync that throws as a generic failure", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockRejectedValue(new Error("network down"));
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Something went wrong. Try again."),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows a throttle notice", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockResolvedValue({ status: "throttled" });
    render(
      <SyncYahooButton leagueId="league-1" syncedAt={new Date().toISOString()} syncError={null} />,
    );

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Synced less than a minute ago."),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the stored sync error in place of the sync time", () => {
    render(
      <SyncYahooButton
        leagueId="league-1"
        syncedAt={new Date().toISOString()}
        syncError="Yahoo isn't answering right now; try again in a minute."
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Yahoo isn't answering right now; try again in a minute.",
    );
  });

  it("names the players a sync could not match", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockResolvedValue({
      status: "ok",
      syncedAt: new Date().toISOString(),
      unmatched: ["Bronny James"],
    });
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} />);

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /^1 player couldn't be matched: Bronny James\. They won't count as rostered, so they may show up as free agents\.$/,
      ),
    );
    expect(refreshMock).toHaveBeenCalled();
  });
});

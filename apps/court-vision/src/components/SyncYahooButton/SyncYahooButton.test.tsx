import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, setSystemTime, vi } from "bun:test";

import { StrictMode } from "react";

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

afterEach(() => {
  cleanup();
  setSystemTime();
});

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
    expect(screen.getByRole("status")).toHaveTextContent(/^Syncing…$/);

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
    // The line reads "Syncing…" while the retry runs, so the repeat is news.
    await waitFor(() => expect(status).toHaveTextContent(/^Syncing…$/));

    second.resolve({ status: "unavailable" });
    await waitFor(() => expect(status).toHaveTextContent(failure));
  });

  it("announces a failure that matches the stored sync error", async () => {
    const user = userEvent.setup();
    const failure = "Yahoo isn't answering right now; try again in a minute.";
    const pending = Promise.withResolvers<YahooSyncResult>();
    syncYahooLeagueMock.mockReturnValueOnce(pending.promise);
    render(<SyncYahooButton leagueId="league-1" syncedAt={null} syncError={failure} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(failure);

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));
    await waitFor(() => expect(status).toHaveTextContent(/^Syncing…$/));

    pending.resolve({ status: "unavailable" });
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

  describe("autoSyncWhenStale", () => {
    const NOW = new Date("2026-10-16T12:00:00.000Z");
    const minutesAgo = (minutes: number): string =>
      new Date(NOW.getTime() - minutes * 60_000).toISOString();

    beforeEach(() => {
      setSystemTime(NOW);
    });

    it("syncs once on mount when the last sync is older than 15 minutes", async () => {
      const pending = Promise.withResolvers<YahooSyncResult>();
      syncYahooLeagueMock.mockReturnValue(pending.promise);
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(16)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Syncing…$/));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
      expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: "league-1" });

      pending.resolve({ status: "ok", syncedAt: NOW.toISOString(), unmatched: [] });

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
    });

    it("syncs on mount when the league has never synced", async () => {
      syncYahooLeagueMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
      });
      render(
        <SyncYahooButton leagueId="league-1" syncedAt={null} syncError={null} autoSyncWhenStale />,
      );

      await waitFor(() => expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    });

    it("does not auto-sync a fresh league", async () => {
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(14)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      // Let any effect flush before asserting nothing happened.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Synced 14 min ago"),
      );
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("does not auto-sync without the flag", async () => {
      render(<SyncYahooButton leagueId="league-1" syncedAt={minutesAgo(60)} syncError={null} />);

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Synced"));
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("does not auto-sync at exactly 15 minutes", async () => {
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(15)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Synced 15 min ago"),
      );
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    });

    it("syncs when the stored sync time cannot be read", async () => {
      syncYahooLeagueMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
      });
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt="garbage"
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    });

    it("keeps the stored status and refreshes when the auto-sync is throttled", async () => {
      syncYahooLeagueMock.mockResolvedValue({ status: "throttled" });
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Synced 30 min ago"),
      );
      expect(screen.getByRole("status")).not.toHaveTextContent("Synced less than a minute ago.");
    });

    it("still shows a stored sync error when the auto-sync is throttled", async () => {
      const storedError = "Yahoo isn't answering right now; try again in a minute.";
      syncYahooLeagueMock.mockResolvedValue({ status: "throttled" });
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={storedError}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(storedError));
      expect(screen.getByRole("status")).not.toHaveTextContent("Synced less than a minute ago.");
    });

    it("syncs once under StrictMode's double-invoked effects", async () => {
      syncYahooLeagueMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
      });
      render(
        <StrictMode>
          <SyncYahooButton
            leagueId="league-1"
            syncedAt={minutesAgo(30)}
            syncError={null}
            autoSyncWhenStale
          />
        </StrictMode>,
      );

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
    });

    it("does not sync again when re-rendered with new or unchanged props", async () => {
      syncYahooLeagueMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
      });
      const { rerender } = render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );
      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));

      rerender(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(1)}
          syncError={null}
          autoSyncWhenStale
        />,
      );
      rerender(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Synced/));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
    });

    it("keeps the stored data and shows the error when the auto-sync fails", async () => {
      syncYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
      render(
        <SyncYahooButton
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Yahoo isn't answering right now; try again in a minute.",
        ),
      );
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
      expect(refreshMock).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    });
  });
});

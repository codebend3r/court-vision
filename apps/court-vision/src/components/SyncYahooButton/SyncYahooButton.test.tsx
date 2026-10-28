import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, setSystemTime, vi } from "bun:test";

import { StrictMode } from "react";

import { type BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { type ExtensionLeagueResult } from "@/lib/yahoo/extensionClient";
import { type YahooSyncResult } from "@/lib/yahoo/types";

type SyncYahooLeagueMockProps = { leagueId: string };

const syncYahooLeagueMock = vi.fn<(args: SyncYahooLeagueMockProps) => Promise<YahooSyncResult>>();

type SyncYahooLeagueProps = { leagueId: string };

vi.mock("@/lib/yahoo/actions", () => ({
  syncYahooLeague: (args: SyncYahooLeagueProps) => syncYahooLeagueMock(args),
}));

type SyncYahooLeagueFromSnapshotMockProps = { leagueId: string; payload: unknown };

const syncYahooLeagueFromSnapshotMock =
  vi.fn<(args: SyncYahooLeagueFromSnapshotMockProps) => Promise<YahooSyncResult>>();

type SyncYahooLeagueFromSnapshotProps = { leagueId: string; payload: unknown };

vi.mock("@/lib/yahoo/snapshotActions", () => ({
  syncYahooLeagueFromSnapshot: (args: SyncYahooLeagueFromSnapshotProps) =>
    syncYahooLeagueFromSnapshotMock(args),
}));

const getExtensionIdMock = vi.fn<() => string | null>();
type FetchLeagueViaExtensionMockProps = { extensionId: string; leagueId: string };

const fetchLeagueViaExtensionMock =
  vi.fn<(args: FetchLeagueViaExtensionMockProps) => Promise<ExtensionLeagueResult>>();

type FetchLeagueViaExtensionProps = { extensionId: string; leagueId: string };

vi.mock("@/lib/yahoo/extensionClient", () => ({
  getExtensionId: () => getExtensionIdMock(),
  fetchLeagueViaExtension: (args: FetchLeagueViaExtensionProps) =>
    fetchLeagueViaExtensionMock(args),
}));

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

import {
  SyncYahooButton,
  type SyncYahooButtonProps,
} from "@/components/SyncYahooButton/SyncYahooButton";

const LEAGUE_URL = "https://basketball.fantasysports.yahoo.com/nba/106344";
const EXTENSION_ID = "court-vision-extension-id";
const PAYLOAD: BridgeLeaguePayload = { game: {}, snapshot: {}, waiverPages: [] };
const NEEDS_EXTENSION = "Syncing this league needs the Court Vision extension in this browser.";

const SERVER_LEAGUE: Pick<SyncYahooButtonProps, "syncVia" | "externalUrl"> = {
  syncVia: "server",
  externalUrl: LEAGUE_URL,
};
const EXTENSION_LEAGUE: Pick<SyncYahooButtonProps, "syncVia" | "externalUrl"> = {
  syncVia: "extension",
  externalUrl: LEAGUE_URL,
};

beforeEach(() => {
  syncYahooLeagueMock.mockReset();
  syncYahooLeagueFromSnapshotMock.mockReset();
  getExtensionIdMock.mockReset();
  getExtensionIdMock.mockReturnValue(null);
  fetchLeagueViaExtensionMock.mockReset();
  fetchLeagueViaExtensionMock.mockResolvedValue({ status: "ok", payload: PAYLOAD });
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
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Never synced");
    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: "league-1" });
    const button = screen.getByRole("button", { name: "Syncing…" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/^Syncing…$/);

    // A second press while pending does nothing.
    await user.click(button);
    expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);

    pending.resolve({
      status: "ok",
      syncedAt: new Date().toISOString(),
      unmatched: [],
      matchupsMissing: false,
    });

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
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

    const button = screen.getByRole("button", { name: "Sync with Yahoo" });
    await user.click(button);
    expect(button).toHaveFocus();

    pending.resolve({
      status: "ok",
      syncedAt: new Date().toISOString(),
      unmatched: [],
      matchupsMissing: false,
    });

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toHaveFocus();
  });

  it("re-announces a failure that repeats", async () => {
    const user = userEvent.setup();
    const failure = "Yahoo isn't answering right now; try again in a minute.";
    syncYahooLeagueMock.mockResolvedValueOnce({ status: "unavailable" });
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );
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
    render(
      <SyncYahooButton
        {...SERVER_LEAGUE}
        leagueId="league-1"
        syncedAt={null}
        syncError={failure}
      />,
    );
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
        {...SERVER_LEAGUE}
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
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(status).toHaveTextContent("Yahoo isn't answering right now; try again in a minute."),
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sync with Yahoo" })).toBeEnabled();
  });

  it("keeps the last sync time under a failed sync's message", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );
    const status = screen.getByRole("status");

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(status).toHaveTextContent(
        /^Yahoo isn't answering right now; try again in a minute\.$/,
      ),
    );
    const syncedTime = screen.getByText("Never synced");
    expect(!!(status.compareDocumentPosition(syncedTime) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
  });

  it("announces a sync that throws as a generic failure", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockRejectedValue(new Error("network down"));
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

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
      <SyncYahooButton
        {...SERVER_LEAGUE}
        leagueId="league-1"
        syncedAt={new Date().toISOString()}
        syncError={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Synced less than a minute ago."),
    );
    // The throttle's message is the time, so no second time line follows it.
    expect(screen.queryByText("Synced just now")).not.toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the stored sync error in place of the sync time", () => {
    render(
      <SyncYahooButton
        {...SERVER_LEAGUE}
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
      matchupsMissing: false,
    });
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /^1 player couldn't be matched: Bronny James\. They won't count as rostered, so they may show up as free agents\.$/,
      ),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("says when a sync landed without this week's matchups", async () => {
    const user = userEvent.setup();
    syncYahooLeagueMock.mockResolvedValue({
      status: "ok",
      syncedAt: new Date().toISOString(),
      unmatched: [],
      matchupsMissing: true,
    });
    render(
      <SyncYahooButton {...SERVER_LEAGUE} leagueId="league-1" syncedAt={null} syncError={null} />,
    );

    await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Synced, but Yahoo's scoreboard didn't load, so this week's matchups weren't updated. Sync again in a minute.",
      ),
    );
  });

  describe("an extension league", () => {
    it("syncs through the extension, never the server", async () => {
      const user = userEvent.setup();
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      syncYahooLeagueFromSnapshotMock.mockResolvedValue({
        status: "ok",
        syncedAt: new Date().toISOString(),
        unmatched: [],
        matchupsMissing: false,
      });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={null}
          syncError={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

      await waitFor(() => expect(refreshMock).toHaveBeenCalled());
      expect(fetchLeagueViaExtensionMock).toHaveBeenCalledWith({
        extensionId: EXTENSION_ID,
        leagueId: "106344",
      });
      expect(syncYahooLeagueFromSnapshotMock).toHaveBeenCalledWith({
        leagueId: "league-1",
        payload: PAYLOAD,
      });
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("Synced just now");
    });

    it("asks for an extension reload when a sync landed without this week's matchups", async () => {
      const user = userEvent.setup();
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      syncYahooLeagueFromSnapshotMock.mockResolvedValue({
        status: "ok",
        syncedAt: new Date().toISOString(),
        unmatched: [],
        matchupsMissing: true,
      });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={null}
          syncError={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Synced, but this week's matchups didn't come through. Reload the Court Vision extension in chrome://extensions, then sync again.",
        ),
      );
    });

    it("says syncing needs the extension", async () => {
      const user = userEvent.setup();
      setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt="2026-10-16T11:30:00.000Z"
          syncError={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

      const status = screen.getByRole("status");
      await waitFor(() => expect(status).toHaveTextContent(NEEDS_EXTENSION));
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(screen.getByText("Synced 30 min ago")).toBeInTheDocument();
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("says why the extension couldn't read the league", async () => {
      const user = userEvent.setup();
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      fetchLeagueViaExtensionMock.mockResolvedValue({ status: "failed", reason: "logged_out" });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={null}
          syncError={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Couldn't read this league with your Yahoo login. Make sure you're signed in to Yahoo in this browser. If you block third-party cookies, allow them for yahoo.com and try again.",
        ),
      );
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
    });

    it("says syncing needs the extension when it stops answering", async () => {
      const user = userEvent.setup();
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      fetchLeagueViaExtensionMock.mockResolvedValue({ status: "missing" });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={null}
          syncError={null}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Sync with Yahoo" }));

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(NEEDS_EXTENSION));
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    });
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
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(16)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Syncing…$/));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
      expect(syncYahooLeagueMock).toHaveBeenCalledWith({ leagueId: "league-1" });

      pending.resolve({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
        matchupsMissing: false,
      });

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
    });

    it("syncs on mount when the league has never synced", async () => {
      syncYahooLeagueMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
        matchupsMissing: false,
      });
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={null}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    });

    it("does not auto-sync a fresh league", async () => {
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
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
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(60)}
          syncError={null}
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Synced"));
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("does not auto-sync at exactly 15 minutes", async () => {
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
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
        matchupsMissing: false,
      });
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
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
          {...SERVER_LEAGUE}
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
          {...SERVER_LEAGUE}
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
        matchupsMissing: false,
      });
      render(
        <StrictMode>
          <SyncYahooButton
            {...SERVER_LEAGUE}
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
        matchupsMissing: false,
      });
      const { rerender } = render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );
      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));

      rerender(
        <SyncYahooButton
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(1)}
          syncError={null}
          autoSyncWhenStale
        />,
      );
      rerender(
        <SyncYahooButton
          {...SERVER_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Synced/));
      expect(syncYahooLeagueMock).toHaveBeenCalledTimes(1);
    });

    it("auto-sync of a stale extension league never falls back to the server", async () => {
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(NEEDS_EXTENSION));
      expect(screen.getByText("Synced 30 min ago")).toBeInTheDocument();
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
      expect(syncYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("auto-syncs a stale extension league through the extension", async () => {
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      syncYahooLeagueFromSnapshotMock.mockResolvedValue({
        status: "ok",
        syncedAt: NOW.toISOString(),
        unmatched: [],
        matchupsMissing: false,
      });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      expect(syncYahooLeagueFromSnapshotMock).toHaveBeenCalledTimes(1);
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    });

    it("refreshes when an extension league's auto-sync is throttled", async () => {
      getExtensionIdMock.mockReturnValue(EXTENSION_ID);
      syncYahooLeagueFromSnapshotMock.mockResolvedValue({ status: "throttled" });
      render(
        <SyncYahooButton
          {...EXTENSION_LEAGUE}
          leagueId="league-1"
          syncedAt={minutesAgo(30)}
          syncError={null}
          autoSyncWhenStale
        />,
      );

      await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("status")).toHaveTextContent("Synced 30 min ago");
      expect(syncYahooLeagueMock).not.toHaveBeenCalled();
    });

    it("keeps the stored data and shows the error when the auto-sync fails", async () => {
      syncYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
      render(
        <SyncYahooButton
          {...SERVER_LEAGUE}
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

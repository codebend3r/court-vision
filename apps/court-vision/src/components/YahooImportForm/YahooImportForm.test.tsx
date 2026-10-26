import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { StrictMode } from "react";

import { restoreEnv, stubEnv } from "@vision/testing/env";
import { type BridgeLeaguePayload } from "@vision/yahoo-bridge/protocol";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";
import { type ExtensionLeagueResult } from "@/lib/yahoo/extensionClient";
import {
  type YahooImportResult,
  type YahooPreview,
  type YahooPreviewResult,
} from "@/lib/yahoo/types";

type PreviewYahooLeagueMockProps = { url: string };

const previewYahooLeagueMock =
  vi.fn<(args: PreviewYahooLeagueMockProps) => Promise<YahooPreviewResult>>();
type ImportYahooLeagueMockProps = { url: string; myTeamExternalKey: string };

const importYahooLeagueMock =
  vi.fn<(args: ImportYahooLeagueMockProps) => Promise<YahooImportResult>>();

type PreviewYahooLeagueProps = { url: string };

type ImportYahooLeagueProps = { url: string; myTeamExternalKey: string };

vi.mock("@/lib/yahoo/actions", () => ({
  previewYahooLeague: (args: PreviewYahooLeagueProps) => previewYahooLeagueMock(args),
  importYahooLeague: (args: ImportYahooLeagueProps) => importYahooLeagueMock(args),
}));

type PreviewYahooSnapshotMockProps = { payload: unknown };

const previewYahooSnapshotMock =
  vi.fn<(args: PreviewYahooSnapshotMockProps) => Promise<YahooPreviewResult>>();
type ImportYahooLeagueFromSnapshotMockProps = { payload: unknown; myTeamExternalKey: string };

const importYahooLeagueFromSnapshotMock =
  vi.fn<(args: ImportYahooLeagueFromSnapshotMockProps) => Promise<YahooImportResult>>();

type PreviewYahooSnapshotProps = { payload: unknown };

type ImportYahooLeagueFromSnapshotProps = { payload: unknown; myTeamExternalKey: string };

vi.mock("@/lib/yahoo/snapshotActions", () => ({
  previewYahooSnapshot: (args: PreviewYahooSnapshotProps) => previewYahooSnapshotMock(args),
  importYahooLeagueFromSnapshot: (args: ImportYahooLeagueFromSnapshotProps) =>
    importYahooLeagueFromSnapshotMock(args),
}));

const getExtensionIdMock = vi.fn<() => string | null>();
type PingExtensionMockProps = { extensionId: string };

const pingExtensionMock = vi.fn<(args: PingExtensionMockProps) => Promise<boolean>>();
type FetchLeagueViaExtensionMockProps = { extensionId: string; leagueId: string };

const fetchLeagueViaExtensionMock =
  vi.fn<(args: FetchLeagueViaExtensionMockProps) => Promise<ExtensionLeagueResult>>();

type PingExtensionProps = { extensionId: string };

type FetchLeagueViaExtensionProps = { extensionId: string; leagueId: string };

type ExtensionStoreUrlProps = { extensionId: string };

vi.mock("@/lib/yahoo/extensionClient", () => ({
  getExtensionId: () => getExtensionIdMock(),
  pingExtension: (args: PingExtensionProps) => pingExtensionMock(args),
  fetchLeagueViaExtension: (args: FetchLeagueViaExtensionProps) =>
    fetchLeagueViaExtensionMock(args),
  extensionStoreUrl: ({ extensionId }: ExtensionStoreUrlProps) =>
    `https://chromewebstore.google.com/detail/${extensionId}`,
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { YahooImportForm } from "@/components/YahooImportForm/YahooImportForm";

const LEAGUE_URL = "https://basketball.fantasysports.yahoo.com/nba/106344";

const HINT =
  "Paste the link from your league's page on basketball.fantasysports.yahoo.com, or just the league ID.";

const preview = (overrides: Partial<YahooPreview> = {}): YahooPreview => ({
  name: "Game of Courts",
  logoUrl: null,
  meta: "12-team · 9-cat",
  unsupportedCategories: [],
  teams: [
    {
      externalKey: "478.l.106344.t.1",
      name: "Better Call Gasol",
      logoUrl: "https://s.yimg.com/cv/apiv2/default/nba/nba_4_g.png",
      managerName: "Saul",
      rosterCount: 13,
      isOwnedByCurrentLogin: false,
    },
    {
      externalKey: "478.l.106344.t.5",
      name: "Newfoundlanders",
      logoUrl: null,
      managerName: null,
      rosterCount: 12,
      isOwnedByCurrentLogin: false,
    },
  ],
  ...overrides,
});

const importedLeague: LeagueSummary = {
  id: "league-9",
  name: "Game of Courts",
  slug: "game-of-courts",
  scoringType: "h2h_categories",
  teamCount: 12,
  rosterSlots: 13,
  scoringConfig: { categories: ["pts"] },
  provider: "yahoo",
  syncVia: "server",
  isImported: true,
  externalUrl: LEAGUE_URL,
  myTeamId: "team-5",
  syncedAt: "2026-10-16T00:00:00.000Z",
  syncError: null,
  unsupportedCategories: [],
  createdAt: "2026-10-16T00:00:00.000Z",
  updatedAt: "2026-10-16T00:00:00.000Z",
};

const EXTENSION_ID = "court-vision-extension-id";

type PayloadProps = { tag: string };

const payload = ({ tag }: PayloadProps): BridgeLeaguePayload => ({
  game: { tag },
  snapshot: { tag },
  waiverPages: [],
});

const mine = (externalKey: string): YahooPreview =>
  preview({
    teams: preview().teams.map((team) => ({
      ...team,
      isOwnedByCurrentLogin: team.externalKey === externalKey,
    })),
  });

beforeEach(() => {
  // The failure copy below is the no-extension copy, whatever a local `.env` sets.
  stubEnv({ key: "NEXT_PUBLIC_COURT_VISION_EXTENSION_ID", value: "" });
  previewYahooLeagueMock.mockReset();
  previewYahooLeagueMock.mockResolvedValue({ status: "ok", preview: preview() });
  importYahooLeagueMock.mockReset();
  importYahooLeagueMock.mockResolvedValue({
    status: "ok",
    league: importedLeague,
    unmatched: [],
  });
  previewYahooSnapshotMock.mockReset();
  previewYahooSnapshotMock.mockResolvedValue({ status: "ok", preview: preview() });
  importYahooLeagueFromSnapshotMock.mockReset();
  importYahooLeagueFromSnapshotMock.mockResolvedValue({
    status: "ok",
    league: importedLeague,
    unmatched: [],
  });
  getExtensionIdMock.mockReset();
  getExtensionIdMock.mockReturnValue(null);
  pingExtensionMock.mockReset();
  pingExtensionMock.mockResolvedValue(false);
  fetchLeagueViaExtensionMock.mockReset();
  fetchLeagueViaExtensionMock.mockResolvedValue({
    status: "ok",
    payload: payload({ tag: "first" }),
  });
  pushMock.mockClear();
  refreshMock.mockClear();
  useLeaguesStore.setState({ leagues: [], activeLeagueId: null });
});

afterEach(() => {
  cleanup();
  restoreEnv();
});

const findLeague = async () => {
  const user = userEvent.setup();
  render(<YahooImportForm />);
  await user.type(screen.getByLabelText("Yahoo league URL"), LEAGUE_URL);
  await user.click(screen.getByRole("button", { name: "Find league" }));
  return user;
};

const teamPicker = () => screen.findByRole("group", { name: "Which team is yours?" });

describe("YahooImportForm", () => {
  it("labels the URL field and describes it", () => {
    render(<YahooImportForm />);

    const field = screen.getByLabelText("Yahoo league URL");
    const hintId = field.getAttribute("aria-describedby") ?? "";
    expect(hintId).not.toBe("");
    expect(document.getElementById(hintId)).toHaveTextContent(HINT);
  });

  it("sends the pasted URL to the preview", async () => {
    await findLeague();

    await waitFor(() => expect(previewYahooLeagueMock).toHaveBeenCalledWith({ url: LEAGUE_URL }));
  });

  it("announces a preview failure", async () => {
    previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });

    await findLeague();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings.",
    );
  });

  it("moves focus to the failure so keyboard users land on it", async () => {
    previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });

    await findLeague();

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("clears the last failure while a new request is pending, so a repeat is announced", async () => {
    previewYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
    const user = await findLeague();
    await screen.findByRole("alert");

    const pending = Promise.withResolvers<YahooPreviewResult>();
    previewYahooLeagueMock.mockReturnValue(pending.promise);
    await user.click(screen.getByRole("button", { name: "Find league" }));

    // React entangles pending async transitions, so an unsettled one would
    // hold every later test's transitions pending: settle it whatever happens.
    try {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      pending.resolve({ status: "unavailable" });
    }
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Yahoo isn't answering right now; try again in a minute.",
    );
  });

  it("moves focus to an import failure", async () => {
    importYahooLeagueMock.mockResolvedValue({ status: "limit" });
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("describes the URL field with the failure as well as the hint", async () => {
    previewYahooLeagueMock.mockResolvedValue({ status: "invalid_url" });

    await findLeague();

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Yahoo league URL")).toHaveAccessibleDescription(
      new RegExp("doesn't look like a Yahoo league link"),
    );
  });

  it("shows the league and asks which team is yours", async () => {
    await findLeague();

    const picker = await teamPicker();
    expect(screen.getByText("Game of Courts")).toBeInTheDocument();
    expect(screen.getByText("12-team · 9-cat")).toBeInTheDocument();
    const radios = within(picker).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    const gasol = within(picker).getByRole("radio", { name: "Better Call Gasol" });
    expect(gasol).toHaveAccessibleDescription(/13 players/);
    expect(within(picker).getByRole("radio", { name: "Newfoundlanders" })).toBeInTheDocument();
    expect(within(picker).getByText("NE")).toBeInTheDocument();
    expect(screen.queryByText(/Not valued/)).not.toBeInTheDocument();
  });

  it("names the categories the league scores that Court Vision can't value", async () => {
    previewYahooLeagueMock.mockResolvedValue({
      status: "ok",
      preview: preview({ unsupportedCategories: ["DD"] }),
    });

    await findLeague();

    await teamPicker();
    expect(screen.getByText("Not valued: DD")).toBeInTheDocument();
  });

  it("moves focus to the team question once the league is found", async () => {
    await findLeague();

    await teamPicker();
    await waitFor(() => expect(screen.getByText("Which team is yours?")).toHaveFocus());
  });

  it("won't import until a team is picked", async () => {
    const user = await findLeague();

    await teamPicker();
    const button = screen.getByRole("button", { name: "Import league" });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(importYahooLeagueMock).not.toHaveBeenCalled();
  });

  it("preselects the team Yahoo says is yours", async () => {
    previewYahooLeagueMock.mockResolvedValue({
      status: "ok",
      preview: preview({
        teams: preview().teams.map((team) => ({
          ...team,
          isOwnedByCurrentLogin: team.externalKey === "478.l.106344.t.5",
        })),
      }),
    });

    await findLeague();

    const picker = await teamPicker();
    expect(within(picker).getByRole("radio", { name: "Newfoundlanders" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Import league" })).toBeEnabled();
  });

  it("imports the picked team and goes to it in My teams", async () => {
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-teams?open=team-5"));
    expect(importYahooLeagueMock).toHaveBeenCalledWith({
      url: LEAGUE_URL,
      myTeamExternalKey: "478.l.106344.t.5",
    });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("league-9");
    expect(useLeaguesStore.getState().leagues.map(({ id }) => id)).toEqual(["league-9"]);
  });

  it("goes to the team even when some players couldn't be matched", async () => {
    importYahooLeagueMock.mockResolvedValue({
      status: "ok",
      league: importedLeague,
      unmatched: ["Jalen Smith"],
    });
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-teams?open=team-5"));
  });

  it("shows progress and keeps the import button disabled while importing", async () => {
    const pending = Promise.withResolvers<YahooImportResult>();
    importYahooLeagueMock.mockReturnValue(pending.promise);
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Importing your league");
    expect(screen.getByRole("button", { name: "Importing league…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change league" })).toBeDisabled();

    pending.resolve({ status: "ok", league: importedLeague, unmatched: [] });
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
  });

  it("stays disabled after the import lands, until the page changes", async () => {
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("button", { name: "Importing league…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Importing your league");
  });

  it("hides the progress and re-enables the button when the import fails", async () => {
    importYahooLeagueMock.mockResolvedValue({ status: "error" });
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import league" })).toBeEnabled();
  });

  it("links to the existing league on duplicate", async () => {
    importYahooLeagueMock.mockResolvedValue({ status: "duplicate", slug: "game-of-courts" });
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You've already imported this league.");
    expect(within(alert).getByRole("link", { name: "Open it" })).toHaveAttribute(
      "href",
      "/leagues/game-of-courts",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("announces an import that throws as a generic failure", async () => {
    importYahooLeagueMock.mockRejectedValue(new Error("network"));
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
  });

  it("goes back to the URL step to pick another league", async () => {
    const user = await findLeague();

    await teamPicker();
    await user.click(screen.getByRole("button", { name: "Change league" }));

    expect(screen.getByLabelText("Yahoo league URL")).toHaveValue(LEAGUE_URL);
    expect(screen.queryByRole("group", { name: "Which team is yours?" })).not.toBeInTheDocument();
  });
});

const EXTENSION_BUTTON = "Import with the Court Vision extension";
const NOT_FOUND_WITH_EXTENSION =
  "Couldn't read this league. If it's private, the commissioner can make it publicly viewable in Yahoo's league settings, or you can import it with the Court Vision extension.";

// Renders with an id configured and waits until the ping has answered.
type RenderWithExtensionProps = { answers: boolean };

const renderWithExtension = async ({ answers }: RenderWithExtensionProps) => {
  getExtensionIdMock.mockReturnValue(EXTENSION_ID);
  pingExtensionMock.mockResolvedValue(answers);
  const user = userEvent.setup();
  render(<YahooImportForm />);
  await waitFor(() =>
    expect(pingExtensionMock).toHaveBeenCalledWith({ extensionId: EXTENSION_ID }),
  );
  if (answers) await screen.findByRole("button", { name: EXTENSION_BUTTON });
  await user.type(screen.getByLabelText("Yahoo league URL"), LEAGUE_URL);
  return user;
};

describe("YahooImportForm with the extension", () => {
  it("shows no extension controls without an id", async () => {
    previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });

    await findLeague();

    await screen.findByRole("alert");
    expect(pingExtensionMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Find league" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
    expect(previewYahooSnapshotMock).not.toHaveBeenCalled();
  });

  it("shows no extension controls when the ping fails", async () => {
    const user = await renderWithExtension({ answers: false });

    expect(pingExtensionMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Find league" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Find league" }));
    await teamPicker();
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
    expect(previewYahooSnapshotMock).not.toHaveBeenCalled();
  });

  it("pings the extension once under StrictMode's double-invoked effects", async () => {
    getExtensionIdMock.mockReturnValue(EXTENSION_ID);
    pingExtensionMock.mockResolvedValue(true);

    render(
      <StrictMode>
        <YahooImportForm />
      </StrictMode>,
    );

    expect(await screen.findByRole("button", { name: EXTENSION_BUTTON })).toBeInTheDocument();
    expect(pingExtensionMock).toHaveBeenCalledTimes(1);
  });

  it("imports a league the server found on the server, even with the extension present", async () => {
    const user = await renderWithExtension({ answers: true });

    await user.click(screen.getByRole("button", { name: "Find league" }));
    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-teams?open=team-5"));
    expect(importYahooLeagueMock).toHaveBeenCalledWith({
      url: LEAGUE_URL,
      myTeamExternalKey: "478.l.106344.t.5",
    });
    expect(importYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
    expect(previewYahooSnapshotMock).not.toHaveBeenCalled();
  });

  it("shows nothing about the extension until the ping answers", async () => {
    getExtensionIdMock.mockReturnValue(EXTENSION_ID);
    const ping = Promise.withResolvers<boolean>();
    pingExtensionMock.mockReturnValue(ping.promise);

    render(<YahooImportForm />);

    try {
      expect(screen.getAllByRole("button")).toHaveLength(1);
    } finally {
      ping.resolve(true);
    }
    expect(await screen.findByRole("button", { name: EXTENSION_BUTTON })).toBeInTheDocument();
  });

  it("previews through the extension and preselects my team", async () => {
    previewYahooSnapshotMock.mockResolvedValue({
      status: "ok",
      preview: mine("478.l.106344.t.5"),
    });
    const user = await renderWithExtension({ answers: true });

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));

    const picker = await teamPicker();
    expect(fetchLeagueViaExtensionMock).toHaveBeenCalledWith({
      extensionId: EXTENSION_ID,
      leagueId: "106344",
    });
    expect(previewYahooSnapshotMock).toHaveBeenCalledWith({ payload: payload({ tag: "first" }) });
    expect(previewYahooLeagueMock).not.toHaveBeenCalled();
    expect(within(picker).getByRole("radio", { name: "Newfoundlanders" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Import league" })).toBeEnabled();
  });

  it("labels the extension button while it reads the league", async () => {
    const user = await renderWithExtension({ answers: true });
    const pending = Promise.withResolvers<ExtensionLeagueResult>();
    fetchLeagueViaExtensionMock.mockReturnValue(pending.promise);

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));

    try {
      expect(screen.getByRole("button", { name: "Reading your league…" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Find league" })).toBeDisabled();
    } finally {
      pending.resolve({ status: "missing" });
    }
    await screen.findByRole("alert");
  });

  it("refetches through the extension on import", async () => {
    fetchLeagueViaExtensionMock
      .mockResolvedValueOnce({ status: "ok", payload: payload({ tag: "first" }) })
      .mockResolvedValueOnce({ status: "ok", payload: payload({ tag: "second" }) });
    const user = await renderWithExtension({ answers: true });

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));
    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/my-teams?open=team-5"));
    expect(fetchLeagueViaExtensionMock).toHaveBeenCalledTimes(2);
    expect(importYahooLeagueFromSnapshotMock).toHaveBeenCalledWith({
      payload: payload({ tag: "second" }),
      myTeamExternalKey: "478.l.106344.t.5",
    });
    expect(importYahooLeagueMock).not.toHaveBeenCalled();
    expect(useLeaguesStore.getState().activeLeagueId).toBe("league-9");
  });

  it("announces an extension failure", async () => {
    fetchLeagueViaExtensionMock.mockResolvedValue({ status: "failed", reason: "logged_out" });
    const user = await renderWithExtension({ answers: true });

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Couldn't read this league with your Yahoo login. Make sure you're signed in to Yahoo in this browser. If you block third-party cookies, allow them for yahoo.com and try again.",
    );
    await waitFor(() => expect(alert).toHaveFocus());
    expect(previewYahooSnapshotMock).not.toHaveBeenCalled();
  });

  it("announces an extension that stops answering before the import", async () => {
    fetchLeagueViaExtensionMock
      .mockResolvedValueOnce({ status: "ok", payload: payload({ tag: "first" }) })
      .mockResolvedValueOnce({ status: "missing" });
    const user = await renderWithExtension({ answers: true });

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));
    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Court Vision extension isn't responding. Check that it's installed and enabled, then try again.",
    );
    expect(importYahooLeagueFromSnapshotMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("checks the URL before asking the extension", async () => {
    const user = await renderWithExtension({ answers: true });
    await user.clear(screen.getByLabelText("Yahoo league URL"));
    await user.type(
      screen.getByLabelText("Yahoo league URL"),
      "https://football.fantasysports.yahoo.com/f1/12345",
    );

    await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That's a Yahoo league for another sport. Only Yahoo Fantasy Basketball leagues can be imported.",
    );
    expect(fetchLeagueViaExtensionMock).not.toHaveBeenCalled();
  });

  describe("offers the extension after a private-league miss", () => {
    it("offers to try with the extension when it answered the ping", async () => {
      previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });
      const user = await renderWithExtension({ answers: true });

      await user.click(screen.getByRole("button", { name: "Find league" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(NOT_FOUND_WITH_EXTENSION);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Try with the extension" }));

      await teamPicker();
      expect(fetchLeagueViaExtensionMock).toHaveBeenCalledWith({
        extensionId: EXTENSION_ID,
        leagueId: "106344",
      });
      expect(previewYahooSnapshotMock).toHaveBeenCalledTimes(1);
    });

    it("keeps focus on the try button while the extension reads the league", async () => {
      previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });
      const user = await renderWithExtension({ answers: true });
      await user.click(screen.getByRole("button", { name: "Find league" }));
      await screen.findByRole("alert");
      const pending = Promise.withResolvers<ExtensionLeagueResult>();
      fetchLeagueViaExtensionMock.mockReturnValue(pending.promise);

      const tryButton = screen.getByRole("button", { name: "Try with the extension" });
      await user.click(tryButton);

      try {
        expect(tryButton).toBeInTheDocument();
        expect(tryButton).toHaveAttribute("aria-disabled", "true");
        expect(tryButton).toHaveFocus();
        // A second press while it reads does nothing.
        await user.click(tryButton);
        expect(fetchLeagueViaExtensionMock).toHaveBeenCalledTimes(1);
      } finally {
        pending.resolve({ status: "ok", payload: payload({ tag: "first" }) });
      }
      await teamPicker();
      await waitFor(() => expect(screen.getByText("Which team is yours?")).toHaveFocus());
    });

    it("drops the try button once its retry settles", async () => {
      previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });
      fetchLeagueViaExtensionMock.mockResolvedValue({ status: "failed", reason: "logged_out" });
      const user = await renderWithExtension({ answers: true });
      await user.click(screen.getByRole("button", { name: "Find league" }));
      await screen.findByRole("alert");

      await user.click(screen.getByRole("button", { name: "Try with the extension" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(/signed in to Yahoo/);

      const pending = Promise.withResolvers<ExtensionLeagueResult>();
      fetchLeagueViaExtensionMock.mockReturnValue(pending.promise);
      await user.click(screen.getByRole("button", { name: EXTENSION_BUTTON }));

      try {
        expect(screen.getByRole("button", { name: "Reading your league…" })).toBeDisabled();
        expect(
          screen.queryByRole("button", { name: "Try with the extension" }),
        ).not.toBeInTheDocument();
      } finally {
        pending.resolve({ status: "missing" });
      }
      await screen.findByRole("alert");
    });

    it("links to the extension when it didn't answer the ping", async () => {
      previewYahooLeagueMock.mockResolvedValue({ status: "not_found" });
      const user = await renderWithExtension({ answers: false });

      await user.click(screen.getByRole("button", { name: "Find league" }));
      await screen.findByRole("alert");

      expect(
        screen.queryByRole("button", { name: "Try with the extension" }),
      ).not.toBeInTheDocument();
      const link = screen.getByRole("link", {
        name: "Get the Court Vision extension (opens in new tab)",
      });
      expect(link).toHaveAttribute(
        "href",
        `https://chromewebstore.google.com/detail/${EXTENSION_ID}`,
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });

    it("offers nothing after a different failure", async () => {
      previewYahooLeagueMock.mockResolvedValue({ status: "unavailable" });
      const user = await renderWithExtension({ answers: true });

      await user.click(screen.getByRole("button", { name: "Find league" }));
      await screen.findByRole("alert");

      expect(
        screen.queryByRole("button", { name: "Try with the extension" }),
      ).not.toBeInTheDocument();
    });
  });
});

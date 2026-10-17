import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { restoreEnv, stubEnv } from "@vision/testing/env";

import { useLeaguesStore } from "@/lib/leagues/store";
import { type LeagueSummary } from "@/lib/leagues/types";
import {
  type YahooImportResult,
  type YahooPreview,
  type YahooPreviewResult,
} from "@/lib/yahoo/types";

const previewYahooLeagueMock = vi.fn<(args: { url: string }) => Promise<YahooPreviewResult>>();
const importYahooLeagueMock =
  vi.fn<(args: { url: string; myTeamExternalKey: string }) => Promise<YahooImportResult>>();

vi.mock("@/lib/yahoo/actions", () => ({
  previewYahooLeague: (args: { url: string }) => previewYahooLeagueMock(args),
  importYahooLeague: (args: { url: string; myTeamExternalKey: string }) =>
    importYahooLeagueMock(args),
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

  it("imports the picked team and goes to the Waiver Wire", async () => {
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/waiver-wire"));
    expect(importYahooLeagueMock).toHaveBeenCalledWith({
      url: LEAGUE_URL,
      myTeamExternalKey: "478.l.106344.t.5",
    });
    expect(useLeaguesStore.getState().activeLeagueId).toBe("league-9");
    expect(useLeaguesStore.getState().leagues.map(({ id }) => id)).toEqual(["league-9"]);
  });

  it("names unmatched players before moving on", async () => {
    importYahooLeagueMock.mockResolvedValue({
      status: "ok",
      league: importedLeague,
      unmatched: ["Jalen Smith"],
    });
    const user = await findLeague();

    const picker = await teamPicker();
    await user.click(within(picker).getByRole("radio", { name: "Newfoundlanders" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Imported. 1 player couldn't be matched: Jalen Smith. They won't count as rostered, so they may show up as free agents.",
      ),
    );
    expect(screen.getByRole("link", { name: "Go to the Waiver Wire" })).toHaveAttribute(
      "href",
      "/waiver-wire",
    );
    expect(pushMock).not.toHaveBeenCalled();
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

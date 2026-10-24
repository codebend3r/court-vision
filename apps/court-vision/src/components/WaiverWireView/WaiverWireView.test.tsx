import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NuqsTestingAdapter,
  withNuqsTestingAdapter,
  type UrlUpdateEvent,
} from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { type ValuationPort } from "@/lib/valuation/valuationClient";

// A worker that never answers: the first valuation runs synchronously on
// mount, so any later request it receives is a second valuation of the pool.
const post = vi.fn<ValuationPort["post"]>();
const fakePort: ValuationPort = { post, listen: () => () => {}, terminate: () => {} };
vi.mock("@/lib/valuation/valuationPort", () => ({ createValuationPort: () => fakePort }));

import {
  WaiverWireView,
  type WaiverWireViewProps,
} from "@/components/WaiverWireView/WaiverWireView";
import { GAME_RANGE_LABELS, PLAYER_GAME_RANGES } from "@/lib/players/searchParams";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { type WaiverLeagueData } from "@/lib/waiverWire/types";
import { DEFAULT_POINTS_SCORING } from "@vision/sport-basketball/engine";
import { type ValuationConfig } from "@vision/sport-basketball/types";

afterEach(cleanup);

beforeEach(() => {
  post.mockReset();
});

// Two of mine (one weak, one strong), a rival's star, three free agents who
// beat my weak player (one per position group) and one who doesn't.
const lines = [
  makeStatLine({ playerId: 1, fullName: "Mine Low", position: "G", pts: 200, reb: 100, ast: 50 }),
  makeStatLine({
    playerId: 2,
    fullName: "Mine High",
    position: "F",
    pts: 1200,
    reb: 400,
    ast: 300,
  }),
  makeStatLine({
    playerId: 3,
    fullName: "Rival Star",
    position: "C",
    pts: 1500,
    reb: 600,
    ast: 300,
  }),
  makeStatLine({
    playerId: 4,
    fullName: "Free Guard",
    position: "G",
    pts: 1000,
    reb: 200,
    ast: 400,
  }),
  makeStatLine({
    playerId: 5,
    fullName: "Free Center",
    position: "C",
    pts: 900,
    reb: 600,
    ast: 100,
  }),
  makeStatLine({
    playerId: 6,
    fullName: "Free Forward",
    position: "F",
    pts: 800,
    reb: 400,
    ast: 200,
  }),
  makeStatLine({ playerId: 7, fullName: "Deep Bench", position: "G", pts: 100, reb: 50, ast: 30 }),
];

const league: WaiverLeagueData = {
  myRoster: [
    { playerId: 1, fullName: "Mine Low", slotType: "BENCH", injuryStatus: null },
    { playerId: 2, fullName: "Mine High", slotType: "UTIL", injuryStatus: null },
  ],
  rosteredPlayerIds: [1, 2, 3],
  waivers: [{ playerId: 5, injuryStatus: null }],
  unmatched: [],
};

const config: ValuationConfig = {
  categories: ["pts", "reb", "ast"],
  weights: {},
  basis: "perGame",
  teams: 12,
  rosterSlots: 13,
  scoring: { ...DEFAULT_POINTS_SCORING },
};

const props: WaiverWireViewProps = {
  range: "all",
  lines,
  league,
  activePlayerIds: [1, 2, 3, 4, 5, 6, 7],
  config,
  methodWeights: {},
  method: "zscore",
};

// The view opens on Available players; most tests are about the swap board, so
// they open there unless they name a view of their own.
const pinView = ({ searchParams }: { searchParams: string }): string => {
  const query = new URLSearchParams(searchParams);
  if (!query.has("view")) query.set("view", "swap");
  return `?${query.toString()}`;
};

const renderView = ({
  searchParams = "?",
  overrides = {},
}: { searchParams?: string; overrides?: Partial<WaiverWireViewProps> } = {}) => {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(<WaiverWireView {...props} {...overrides} />, {
    wrapper: withNuqsTestingAdapter({
      searchParams: pinView({ searchParams }),
      onUrlUpdate,
      hasMemory: true,
    }),
  });
  return { onUrlUpdate };
};

const lastUpdate = ({
  onUrlUpdate,
}: {
  onUrlUpdate: ReturnType<typeof vi.fn<(event: UrlUpdateEvent) => void>>;
}): UrlUpdateEvent | null => onUrlUpdate.mock.calls.at(-1)?.[0] ?? null;

// The free agents a panel lists, by their Compare buttons: one each, and mine
// never have one.
const comparedNames = ({ panel }: { panel: HTMLElement }): string[] =>
  within(panel)
    .queryAllByRole("button", { name: /^Compare .* head-to-head$/ })
    .map((button) =>
      (button.getAttribute("aria-label") ?? "")
        .replace(/^Compare /, "")
        .replace(/ head-to-head$/, ""),
    );

const swapNames = (): string[] =>
  comparedNames({ panel: screen.getByRole("tabpanel", { name: "Swap board" }) });

describe("WaiverWireView available players", () => {
  const availableNames = (): string[] =>
    comparedNames({ panel: screen.getByRole("tabpanel", { name: "Available players" }) });

  it("opens on every player nobody in the league has, not only those who beat your weakest", () => {
    const { onUrlUpdate } = renderView({ searchParams: "?view=available" });
    expect(lastUpdate({ onUrlUpdate })).toBeNull();
    // Deep Bench is worse than my weakest player, so no swap board lists them.
    expect(availableNames()).toEqual(
      expect.arrayContaining(["Free Guard", "Free Center", "Free Forward", "Deep Bench"]),
    );
    expect(availableNames()).toHaveLength(4);
    expect(availableNames()).not.toContain("Rival Star");
    expect(availableNames()).not.toContain("Mine High");
  });

  it("links a name to the player's profile and never opens head-to-head from it", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView({ searchParams: "?view=available" });

    const link = within(screen.getByRole("tabpanel", { name: "Available players" })).getByRole(
      "link",
      { name: "Free Guard" },
    );
    expect(link).toHaveAttribute("href", "/players/4");
    await user.click(link);

    expect(screen.getByRole("tab", { name: "Available players" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(lastUpdate({ onUrlUpdate })).toBeNull();
  });

  it("lets the user star a free agent from the table", () => {
    renderView({ searchParams: "?view=available" });

    expect(
      within(screen.getByRole("tabpanel", { name: "Available players" })).getByRole("button", {
        name: "Star Free Guard",
      }),
    ).toBeInTheDocument();
  });

  it("narrows the list to a position group", async () => {
    const user = userEvent.setup();
    renderView({ searchParams: "?view=available" });
    await user.click(screen.getByRole("button", { name: "Guards" }));
    expect(availableNames().sort()).toEqual(["Deep Bench", "Free Guard"]);
  });

  it("opens head-to-head from a name", async () => {
    const user = userEvent.setup();
    renderView({ searchParams: "?view=available" });
    await user.click(screen.getByRole("button", { name: "Compare Deep Bench head-to-head" }));
    expect(screen.getByRole("tab", { name: "Head-to-head" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("is the view a visit with no query lands on", () => {
    // Not pinned: no view in the URL.
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    render(<WaiverWireView {...props} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?", onUrlUpdate, hasMemory: true }),
    });
    expect(screen.getByRole("tab", { name: "Available players" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("WaiverWireView", () => {
  it("values the pool once and opens on the swap board", async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.getByRole("region", { name: "Waiver Wire" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Swap board" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(swapNames().toSorted()).toEqual(["Free Center", "Free Forward", "Free Guard"]);

    await user.click(screen.getByRole("tab", { name: "Cut line" }));
    await user.click(screen.getByRole("button", { name: "Guards" }));
    await user.click(screen.getByRole("tab", { name: "Head-to-head" }));

    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Waiver Wire" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("changes range through the URL", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView({ searchParams: "?range=last20" });

    const select = screen.getByRole("combobox", { name: "Range" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(PLAYER_GAME_RANGES.map((range) => GAME_RANGE_LABELS[range]));
    expect(select).toHaveValue("last20");

    await user.selectOptions(select, GAME_RANGE_LABELS.last10);

    await waitFor(() =>
      expect(lastUpdate({ onUrlUpdate })?.searchParams.get("range") ?? null).toBe("last10"),
    );
    expect(lastUpdate({ onUrlUpdate })?.options.shallow).toBe(false);
    expect(select).toHaveValue("last10");
  });

  it("names the league's unmatched players under the controls, calling out yours", () => {
    renderView({
      overrides: {
        league: {
          ...league,
          unmatched: [
            { fullName: "Bronny James", isMine: true },
            { fullName: "Kel'el Ware", isMine: false },
          ],
        },
      },
    });

    expect(
      screen.getByText(
        "2 players couldn't be matched to Court Vision (Bronny James, Kel'el Ware; yours: Bronny James). They won't count as rostered, so they may show up as free agents.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about unmatched players when every player matched", () => {
    renderView();

    expect(screen.queryByText(/couldn't be matched/)).not.toBeInTheDocument();
  });

  it("keeps valuing the loaded pool with its own range while a new range loads", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView({
      searchParams: "?range=last20",
      overrides: { range: "last20" },
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Range" }),
      GAME_RANGE_LABELS.last10,
    );

    await waitFor(() =>
      expect(lastUpdate({ onUrlUpdate })?.searchParams.get("range") ?? null).toBe("last10"),
    );
    expect(screen.getByRole("combobox", { name: "Range" })).toHaveValue("last10");
    // Same lines, same window: nothing to re-value until the server's pool lands.
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Waiver Wire" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  it("filters free agents by position", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView();

    const group = screen.getByRole("group", { name: "Position" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All", "G", "F", "C"]);
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(group).getByRole("button", { name: "Centers" }));

    expect(within(group).getByRole("button", { name: "Centers" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(swapNames()).toEqual(["Free Center"]);
    await waitFor(() =>
      expect(lastUpdate({ onUrlUpdate })?.searchParams.get("pos") ?? null).toBe("C"),
    );
    expect(lastUpdate({ onUrlUpdate })?.options.history).toBe("replace");
  });

  it("opens head-to-head from a free agent", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView({ searchParams: "?mine=2" });

    await user.click(
      within(screen.getByRole("tabpanel", { name: "Swap board" })).getByRole("button", {
        name: "Compare Free Center head-to-head",
      }),
    );

    expect(screen.getByRole("tab", { name: "Head-to-head" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(screen.getByRole("tabpanel", { name: "Head-to-head" })).getByText(
        /^Free Center wins \d of 3$/,
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = lastUpdate({ onUrlUpdate });
    expect(update?.searchParams.get("view") ?? null).toBe("h2h");
    expect(update?.searchParams.get("fa") ?? null).toBe("5");
    expect(update?.searchParams.has("mine") ?? true).toBe(false);
    expect(update?.options.history).toBe("replace");
  });

  it("changes one side of the head-to-head pair through the URL", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderView({ searchParams: "?view=h2h&fa=5" });
    const panel = screen.getByRole("tabpanel", { name: "Head-to-head" });

    await user.selectOptions(
      within(panel).getByRole("combobox", { name: "Your player" }),
      "Mine High",
    );

    await waitFor(() =>
      expect(lastUpdate({ onUrlUpdate })?.searchParams.get("mine") ?? null).toBe("2"),
    );
    const update = lastUpdate({ onUrlUpdate });
    expect(update?.searchParams.get("fa") ?? null).toBe("5");
    expect(update?.options.history).toBe("replace");
    expect(within(panel).getByText(/^Free Center wins \d of 3$/)).toBeInTheDocument();
  });

  it("keeps focus on the Head-to-head tab after opening a free agent", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(
      within(screen.getByRole("tabpanel", { name: "Swap board" })).getByRole("button", {
        name: "Compare Free Center head-to-head",
      }),
    );

    expect(screen.getByRole("tab", { name: "Head-to-head" })).toHaveFocus();
  });

  it("describes every free agent's Compare button with one compare hint", () => {
    renderView();

    const hint = "Compare head-to-head against your weakest player";
    expect(screen.getAllByText(hint)).toHaveLength(1);
    const compareButtons = within(
      screen.getByRole("tabpanel", { name: "Swap board" }),
    ).getAllByRole("button", { name: /^Compare / });
    expect(compareButtons.length).toBeGreaterThan(0);
    compareButtons.map((button) => expect(button).toHaveAccessibleDescription(hint));
  });

  it("announces what the panel shows after a position change", async () => {
    const user = userEvent.setup();
    renderView();

    expect(screen.getByRole("status")).toHaveTextContent("3 free agents beat Mine Low");

    await user.click(screen.getByRole("button", { name: "Centers" }));

    expect(screen.getByRole("status")).toHaveTextContent("1 free agent beats Mine Low");

    await user.click(screen.getByRole("tab", { name: "Head-to-head" }));

    expect(screen.getByRole("status")).toHaveTextContent(/^Free Center wins \d of 3$/);

    await user.click(screen.getByRole("tab", { name: "Cut line" }));

    expect(screen.getByRole("status")).toHaveTextContent(/^\d+ of \d+ players shown$/);
  });

  it("says no free agent matches on head-to-head when the free pool is empty", () => {
    renderView({
      searchParams: "?view=h2h",
      overrides: { league: { ...league, rosteredPlayerIds: [1, 2, 3, 4, 5, 6, 7], waivers: [] } },
    });

    const panel = screen.getByRole("tabpanel", { name: "Head-to-head" });
    expect(
      within(panel).getByText("No free agents match this range and position."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No free agents match this range and position.",
    );
  });

  it("names the position filters in full", () => {
    renderView();

    const group = screen.getByRole("group", { name: "Position" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label") ?? button.textContent),
    ).toEqual(["All", "Guards", "Forwards", "Centers"]);
  });

  it("windows the cut line again whenever its scope, range or position changes", async () => {
    const user = userEvent.setup();
    // Eight more free agents below my weakest, so the window hides some.
    const deep = Array.from({ length: 8 }, (_, index) =>
      makeStatLine({
        playerId: 20 + index,
        fullName: `Deep ${index}`,
        position: "G",
        pts: 60 - index * 5,
        reb: 20,
        ast: 10,
      }),
    );
    renderView({
      searchParams: "?view=cut",
      overrides: {
        lines: [...lines, ...deep],
        activePlayerIds: [...props.activePlayerIds, ...deep.map((line) => line.playerId)],
      },
    });
    const label = () => screen.queryByRole("button", { name: /^Show all/ })?.textContent ?? "none";
    const expand = async () => {
      await user.click(screen.getByRole("button", { name: /^Show all/ }));
      expect(label()).toBe("none");
    };

    await expand();
    await user.click(screen.getByRole("button", { name: "Free agents only" }));
    expect(label()).toMatch(/^Show all/);
    await user.click(screen.getByRole("button", { name: "My team and free agents" }));
    expect(label()).toMatch(/^Show all/);

    await expand();
    const range = screen.getByRole("combobox", { name: "Range" });
    await user.selectOptions(range, GAME_RANGE_LABELS.last10);
    expect(label()).toMatch(/^Show all/);
    await user.selectOptions(range, GAME_RANGE_LABELS.all);
    expect(label()).toMatch(/^Show all/);

    await expand();
    await user.click(screen.getByRole("button", { name: "Guards" }));
    expect(label()).toMatch(/^Show all/);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(label()).toMatch(/^Show all/);
  });

  it("windows the cut line again after the URL leaves its list and comes back", async () => {
    const user = userEvent.setup();
    // Eight more free agents below my weakest, so the window hides some.
    const deep = Array.from({ length: 8 }, (_, index) =>
      makeStatLine({
        playerId: 20 + index,
        fullName: `Deep ${index}`,
        position: "G",
        pts: 60 - index * 5,
        reb: 20,
        ast: 10,
      }),
    );
    const viewProps: WaiverWireViewProps = {
      ...props,
      lines: [...lines, ...deep],
      activePlayerIds: [...props.activePlayerIds, ...deep.map((line) => line.playerId)],
    };
    // The back and forward buttons, as the adapter's search params changing
    // underneath the view.
    const atUrl = ({ searchParams }: { searchParams: string }) => (
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <WaiverWireView {...viewProps} />
      </NuqsTestingAdapter>
    );
    const { rerender } = render(atUrl({ searchParams: "?view=cut" }));
    const hasShowAll = () => !!screen.queryByRole("button", { name: /^Show all/ });

    await user.click(screen.getByRole("button", { name: /^Show all/ }));
    expect(hasShowAll()).toBe(false);

    rerender(atUrl({ searchParams: "?view=cut&scope=fa" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Free agents only" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    rerender(atUrl({ searchParams: "?view=cut" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "My team and free agents" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );

    expect(hasShowAll()).toBe(true);
  });

  it("collapses the swap board again when its range or position changes", async () => {
    const user = userEvent.setup();
    // Thirty guards who all beat my weakest, so the board needs Show all.
    const guards = Array.from({ length: 30 }, (_, index) =>
      makeStatLine({
        playerId: 40 + index,
        fullName: `Guard ${index}`,
        position: "G",
        pts: 700 + index * 10,
        reb: 200,
        ast: 200,
      }),
    );
    renderView({
      overrides: {
        lines: [...lines, ...guards],
        activePlayerIds: [...props.activePlayerIds, ...guards.map((line) => line.playerId)],
      },
    });
    const swapPanel = () => screen.getByRole("tabpanel", { name: "Swap board" });
    const hasShowAll = () => !!within(swapPanel()).queryByRole("button", { name: /^Show all/ });
    const expand = async () => {
      await user.click(within(swapPanel()).getByRole("button", { name: /^Show all/ }));
      expect(hasShowAll()).toBe(false);
    };

    await expand();
    await user.click(screen.getByRole("button", { name: "Guards" }));
    expect(hasShowAll()).toBe(true);

    await expand();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Range" }),
      GAME_RANGE_LABELS.last10,
    );
    expect(hasShowAll()).toBe(true);
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SwapBoardPanel } from "@/components/WaiverWireView/SwapBoardPanel";
import { type SwapBoard, type SwapRow } from "@/lib/waiverWire/swapBoard";
import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/waiver-wire",
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

type MakeRowProps = Partial<WaiverRow> & { playerId: number };

const makeRow = (overrides: MakeRowProps): WaiverRow => ({
  fullName: `Player ${overrides.playerId}`,
  teamAbbr: "DET",
  position: "C",
  nbaPersonId: null,
  value: 0,
  rank: overrides.playerId,
  owner: "mine",
  injuryStatus: null,
  ...overrides,
});

const reed = makeRow({ playerId: 1, fullName: "Paul Reed", value: -0.42 });
const queta = makeRow({ playerId: 2, fullName: "Neemias Queta", value: 0.08, injuryStatus: "Q" });

const carter: SwapRow = {
  ...makeRow({
    playerId: 10,
    fullName: "Wendell Carter Jr.",
    teamAbbr: "ORL",
    value: 0.94,
    owner: "waivers",
  }),
  gain: 1.36,
  chips: [
    { key: "reb", text: "+REB", improves: true },
    { key: "pts", text: "+PTS", improves: true },
    { key: "fg", text: "−FG%", improves: false },
  ],
};

const model: WaiverModel = {
  roster: [queta, reed],
  noStats: [],
  weakest: [reed, queta],
  freePool: [carter],
};

const board: SwapBoard = { target: reed, rows: [carter] };

type RenderPanelProps = { boardOverride?: SwapBoard; modelOverride?: WaiverModel };

const renderPanel = ({ boardOverride = board, modelOverride = model }: RenderPanelProps = {}) => {
  type OnCompareProps = { fa: number };

  const onCompare = vi.fn<({ fa }: OnCompareProps) => void>();
  render(
    <SwapBoardPanel
      board={boardOverride}
      model={modelOverride}
      onCompare={onCompare}
      compareHintId="compare-hint"
    />,
  );
  return { onCompare };
};

const weakestPanel = () => screen.getByRole("region", { name: "Your weakest" });
const freePanel = () => screen.getByRole("region", { name: "Free agents that beat them" });

// Body rows only: the header row holds column headers, not cells.
type BodyRowsProps = { panel: HTMLElement };

const bodyRows = ({ panel }: BodyRowsProps) =>
  within(panel)
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("cell").length > 0);

describe("SwapBoardPanel", () => {
  it("titles its two panel shells", () => {
    renderPanel();

    expect(weakestPanel()).toHaveClass("panel");
    expect(freePanel()).toHaveClass("panel");
    expect(within(freePanel()).getByText("sorted by gain over Paul Reed")).toBeInTheDocument();
  });

  it("lists your weakest with their values and links to each player", () => {
    renderPanel();

    const rows = bodyRows({ panel: weakestPanel() });
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(within(first).getByRole("link", { name: "Paul Reed" })).toHaveAttribute(
      "href",
      "/players/1",
    );
    expect(within(first).getByText("−0.42")).toHaveClass("numeric");
    expect(within(second).getByText("Questionable")).toBeInTheDocument();
  });

  it("shows each free agent's value, signed gain and category chips", () => {
    renderPanel();

    const [row] = bodyRows({ panel: freePanel() });
    const cells = within(row);
    expect(cells.getByText("0.94")).toHaveClass("numeric");
    expect(cells.getByText("+1.36")).toHaveClass("numeric");
    expect(cells.getByText("On waivers")).toBeInTheDocument();
    expect(cells.getAllByRole("listitem").map((chip) => chip.textContent)).toEqual([
      "+REB (better)",
      "+PTS (better)",
      "−FG% (worse)",
    ]);
    expect(cells.getByText("(worse)")).toHaveClass("srOnly");
    cells.getAllByText("(better)").map((hint) => expect(hint).toHaveClass("srOnly"));
  });

  it("opens head-to-head from a free agent's Compare button", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPanel();

    await user.click(
      within(freePanel()).getByRole("button", { name: "Compare Wendell Carter Jr. head-to-head" }),
    );

    expect(onCompare).toHaveBeenCalledWith({ fa: 10 });
  });

  it("shows 25 free agents, then every one on Show all, then 25 again", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, index): SwapRow => ({
      ...makeRow({ playerId: 100 + index, owner: "free_agent", value: 2 - index / 100 }),
      gain: 2.42 - index / 100,
      chips: [],
    }));
    renderPanel({ boardOverride: { target: reed, rows } });

    expect(bodyRows({ panel: freePanel() })).toHaveLength(25);

    const toggle = within(freePanel()).getByRole("button", { name: "Show all 30 free agents" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(bodyRows({ panel: freePanel() })).toHaveLength(30);
    // The same button stays mounted, so focus stays on it.
    expect(toggle).toHaveAccessibleName("Show fewer");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveFocus();

    await user.click(toggle);

    expect(bodyRows({ panel: freePanel() })).toHaveLength(25);
    expect(toggle).toHaveAccessibleName("Show all 30 free agents");
  });

  it("hides Show all when every free agent fits", () => {
    renderPanel();

    expect(screen.queryByRole("button", { name: /^Show all/ })).not.toBeInTheDocument();
  });

  it("lists your players with no stats under a disclosure", () => {
    renderPanel({
      modelOverride: {
        ...model,
        noStats: [{ playerId: 3, fullName: "Rookie Stash", slotType: "BENCH", injuryStatus: "O" }],
      },
    });

    const summary = within(weakestPanel()).getByText("No stats in this range");
    const details = summary.closest("details");
    if (details === null) throw new Error("expected the summary inside a <details>");
    expect(within(details).getByRole("link", { name: "Rookie Stash" })).toHaveAttribute(
      "href",
      "/players/3",
    );
    expect(within(details).getByText("Out")).toBeInTheDocument();
  });

  it("leaves the disclosure out when every player has stats", () => {
    renderPanel();

    expect(screen.queryByText("No stats in this range")).not.toBeInTheDocument();
  });

  it("says so when no free agent qualifies", () => {
    renderPanel({ boardOverride: { target: reed, rows: [] } });

    expect(
      within(freePanel()).getByText("No free agent beats your weakest player in this range."),
    ).toBeInTheDocument();
    expect(within(freePanel()).queryByRole("table")).not.toBeInTheDocument();
  });

  it("says so when no one on your roster has stats", () => {
    renderPanel({
      boardOverride: { target: null, rows: [] },
      modelOverride: { roster: [], noStats: [], weakest: [], freePool: [carter] },
    });

    expect(
      within(weakestPanel()).getByText(
        "No one on your roster has stats in this range. Try a longer range.",
      ),
    ).toBeInTheDocument();
    expect(within(weakestPanel()).queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Free agents that beat them" }),
    ).not.toBeInTheDocument();
  });
});

describe("SwapBoardPanel sorting", () => {
  const gafford: SwapRow = {
    ...makeRow({ playerId: 11, fullName: "Daniel Gafford", value: 0.3, owner: "free_agent" }),
    gain: 0.72,
    chips: [
      { key: "reb", text: "+REB", improves: true },
      { key: "pts", text: "+PTS", improves: true },
      { key: "ast", text: "+AST", improves: true },
    ],
  };
  const missi: SwapRow = {
    ...makeRow({ playerId: 12, fullName: "Yves Missi", value: 0.5, owner: "free_agent" }),
    gain: 0.92,
    chips: [{ key: "fg", text: "−FG%", improves: false }],
  };
  const sortBoard: SwapBoard = { target: reed, rows: [carter, missi, gafford] };

  const freeNames = (): string[] =>
    bodyRows({ panel: freePanel() }).map(
      (row) => within(row).getAllByRole("link")[0]?.textContent ?? "",
    );
  const weakestNames = (): string[] =>
    bodyRows({ panel: weakestPanel() }).map(
      (row) => within(row).getAllByRole("link")[0]?.textContent ?? "",
    );
  type SortByProps = { panel: HTMLElement; name: string };

  const sortBy = async ({ panel, name }: SortByProps) =>
    userEvent.click(
      within(within(panel).getByRole("columnheader", { name: new RegExp(`^${name}`) })).getByRole(
        "button",
      ),
    );

  it("opens in the board's own order, gain first", () => {
    renderPanel({ boardOverride: sortBoard });
    expect(freeNames()).toEqual(["Wendell Carter Jr.", "Yves Missi", "Daniel Gafford"]);
    expect(within(freePanel()).getByText("sorted by gain over Paul Reed")).toBeInTheDocument();
  });

  it("sorts the free agents on value, highest first, then lowest, then back", async () => {
    renderPanel({ boardOverride: sortBoard });

    await sortBy({ panel: freePanel(), name: "Value" });
    expect(freeNames()).toEqual(["Wendell Carter Jr.", "Yves Missi", "Daniel Gafford"]);
    await sortBy({ panel: freePanel(), name: "Value" });
    expect(freeNames()).toEqual(["Daniel Gafford", "Yves Missi", "Wendell Carter Jr."]);
    await sortBy({ panel: freePanel(), name: "Value" });
    expect(freeNames()).toEqual(["Wendell Carter Jr.", "Yves Missi", "Daniel Gafford"]);
  });

  it("sorts the free agents on gain", async () => {
    renderPanel({ boardOverride: sortBoard });

    await sortBy({ panel: freePanel(), name: "Gain" });
    await sortBy({ panel: freePanel(), name: "Gain" });

    expect(freeNames()).toEqual(["Daniel Gafford", "Yves Missi", "Wendell Carter Jr."]);
  });

  it("sorts the free agents on how many categories the swap improves", async () => {
    renderPanel({ boardOverride: sortBoard });

    await sortBy({ panel: freePanel(), name: "Categories" });

    expect(freeNames()).toEqual(["Daniel Gafford", "Wendell Carter Jr.", "Yves Missi"]);
  });

  it("sorts the free agents by name, alphabetically first", async () => {
    renderPanel({ boardOverride: sortBoard });

    await sortBy({ panel: freePanel(), name: "Free agent" });

    expect(freeNames()).toEqual(["Daniel Gafford", "Wendell Carter Jr.", "Yves Missi"]);
  });

  it("says how many free agents there are once sorted, not that they are sorted by gain", async () => {
    renderPanel({ boardOverride: sortBoard });

    await sortBy({ panel: freePanel(), name: "Value" });

    expect(within(freePanel()).getByText("3 free agents")).toBeInTheDocument();
    expect(within(freePanel()).queryByText(/sorted by gain/)).not.toBeInTheDocument();
  });

  it("sorts your weakest too, independently of the free agents", async () => {
    renderPanel({ boardOverride: sortBoard });
    expect(weakestNames()).toEqual(["Paul Reed", "Neemias Queta"]);

    await sortBy({ panel: weakestPanel(), name: "Value" });

    expect(weakestNames()).toEqual(["Neemias Queta", "Paul Reed"]);
    expect(freeNames()).toEqual(["Wendell Carter Jr.", "Yves Missi", "Daniel Gafford"]);
  });

  it("right-aligns the numeric headers over their numbers", () => {
    renderPanel({ boardOverride: sortBoard });
    const free = within(freePanel());
    expect(free.getByRole("columnheader", { name: /^Value/ })).toHaveClass("numeric");
    expect(free.getByRole("columnheader", { name: /^Gain/ })).toHaveClass("numeric");
    expect(free.getByRole("columnheader", { name: /^Free agent/ })).not.toHaveClass("numeric");
  });
});

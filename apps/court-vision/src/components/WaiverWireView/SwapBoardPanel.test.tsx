import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SwapBoardPanel } from "@/components/WaiverWireView/SwapBoardPanel";
import { type SwapBoard, type SwapRow } from "@/lib/waiverWire/swapBoard";
import { type WaiverModel, type WaiverRow } from "@/lib/waiverWire/types";

afterEach(cleanup);

const makeRow = (overrides: Partial<WaiverRow> & { playerId: number }): WaiverRow => ({
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

const renderPanel = ({
  boardOverride = board,
  modelOverride = model,
}: { boardOverride?: SwapBoard; modelOverride?: WaiverModel } = {}) => {
  const onCompare = vi.fn<({ fa }: { fa: number }) => void>();
  render(<SwapBoardPanel board={boardOverride} model={modelOverride} onCompare={onCompare} />);
  return { onCompare };
};

const weakestPanel = () => screen.getByRole("region", { name: "Your weakest" });
const freePanel = () => screen.getByRole("region", { name: "Free agents that beat them" });

// Body rows only: the header row holds column headers, not cells.
const bodyRows = ({ panel }: { panel: HTMLElement }) =>
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
    expect(within(first).getByText("-0.42")).toHaveClass("numeric");
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
      "+REB",
      "+PTS",
      "−FG% (worse)",
    ]);
    expect(cells.getByText("(worse)")).toHaveClass("srOnly");
  });

  it("opens head-to-head from a free agent's name", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPanel();

    await user.click(within(freePanel()).getByRole("button", { name: "Wendell Carter Jr." }));

    expect(onCompare).toHaveBeenCalledWith({ fa: 10 });
  });

  it("shows 25 free agents, then every one on Show all", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, index): SwapRow => ({
      ...makeRow({ playerId: 100 + index, owner: "free_agent", value: 2 - index / 100 }),
      gain: 2.42 - index / 100,
      chips: [],
    }));
    renderPanel({ boardOverride: { target: reed, rows } });

    expect(bodyRows({ panel: freePanel() })).toHaveLength(25);

    await user.click(within(freePanel()).getByRole("button", { name: "Show all" }));

    expect(bodyRows({ panel: freePanel() })).toHaveLength(30);
    expect(within(freePanel()).queryByRole("button", { name: "Show all" })).not.toBeInTheDocument();
  });

  it("hides Show all when every free agent fits", () => {
    renderPanel();

    expect(screen.queryByRole("button", { name: "Show all" })).not.toBeInTheDocument();
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

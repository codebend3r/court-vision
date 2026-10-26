import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { HeadToHeadPanel, type HeadToHeadPick } from "@/components/WaiverWireView/HeadToHeadPanel";
import {
  type HeadToHead,
  type HeadToHeadPair,
  type HeadToHeadRow,
  headToHeadSummary,
} from "@/lib/waiverWire/headToHead";
import { type WaiverRow } from "@/lib/waiverWire/types";

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

const carter = makeRow({
  playerId: 10,
  fullName: "Wendell Carter Jr.",
  teamAbbr: "ORL",
  value: 0.94,
  owner: "free_agent",
});
const gafford = makeRow({ playerId: 11, fullName: "Daniel Gafford", owner: "waivers" });
const reed = makeRow({ playerId: 1, fullName: "Paul Reed", value: -0.42 });
const hartenstein = makeRow({ playerId: 2, fullName: "Isaiah Hartenstein", value: 1.12 });

const pair: HeadToHeadPair = { fa: carter, mine: reed };

const rows: HeadToHeadRow[] = [
  {
    key: "fg",
    label: "FG%",
    kind: "ratio",
    faPerGame: 0.532,
    minePerGame: 0.56,
    winner: "mine",
    teamDelta: -0.002,
    teamDeltaImproves: false,
  },
  {
    key: "pts",
    label: "PTS",
    kind: "counting",
    faPerGame: 11.8,
    minePerGame: 6.4,
    winner: "fa",
    teamDelta: 5.4,
    teamDeltaImproves: true,
  },
  {
    key: "reb",
    label: "REB",
    kind: "counting",
    faPerGame: 8.2,
    minePerGame: 4.9,
    winner: "fa",
    teamDelta: 3.3,
    teamDeltaImproves: true,
  },
  {
    key: "tpm",
    label: "3PTM",
    kind: "counting",
    faPerGame: 0,
    minePerGame: 0,
    winner: "tie",
    teamDelta: 0,
    teamDeltaImproves: null,
  },
  {
    key: "ast",
    label: "AST",
    kind: "counting",
    faPerGame: 1.9,
    minePerGame: 1.1,
    winner: "fa",
    teamDelta: 0.04,
    teamDeltaImproves: true,
  },
  {
    key: "ft",
    label: "FT%",
    kind: "ratio",
    faPerGame: 0.76,
    minePerGame: 0.68,
    winner: "fa",
    teamDelta: 0.0004,
    teamDeltaImproves: true,
  },
];

const result: HeadToHead = { rows, faWins: 4, categoryCount: 6 };

type RenderPanelProps = { withPair?: boolean; freePool?: WaiverRow[]; roster?: WaiverRow[] };

const renderPanel = ({
  withPair = true,
  freePool = [carter, gafford],
  roster = [hartenstein, reed],
}: RenderPanelProps = {}) => {
  const onPick = vi.fn<(pick: HeadToHeadPick) => void>();
  render(
    <HeadToHeadPanel
      pair={withPair ? pair : null}
      result={withPair ? result : null}
      freePool={freePool}
      roster={roster}
      onPick={onPick}
    />,
  );
  return { onPick };
};

type RowOfProps = { label: string };

const rowOf = ({ label }: RowOfProps): HTMLElement => {
  const row = screen.getByRole("rowheader", { name: label }).closest("tr");
  if (row === null) throw new Error(`expected ${label} in a table row`);
  return row;
};

// A readout card, found by its label line.
type CardOfProps = { label: string };

const cardOf = ({ label }: CardOfProps): HTMLElement => {
  const card = screen.getByText(label, { selector: "p" }).closest("article");
  if (card === null) throw new Error(`expected a readout card labelled ${label}`);
  return card;
};

type CellsOfProps = { label: string };

const cellsOf = ({ label }: CellsOfProps): HTMLElement[] =>
  Array.from(rowOf({ label }).querySelectorAll<HTMLElement>("td, th"));

// The table's columns, left to right.
const COLUMN = { fa: 0, mine: 1, category: 2, delta: 3 } as const;

type CellOfProps = { label: string; column: keyof typeof COLUMN };

const cellOf = ({ label, column }: CellOfProps): HTMLElement => {
  const cell = cellsOf({ label })[COLUMN[column]];
  if (cell === undefined) throw new Error(`expected a ${column} cell in the ${label} row`);
  return cell;
};

// The widths of the decorative bar's two halves in a row's free-agent cell.
type BarHalvesProps = { label: string };

const barHalves = ({ label }: BarHalvesProps): string[] =>
  Array.from(
    cellOf({ label, column: "fa" }).querySelectorAll<HTMLElement>("[aria-hidden='true'] [style]"),
  ).map((half) => half.style.width);

describe("HeadToHeadPanel", () => {
  it("compares the picked players category by category", () => {
    renderPanel();

    const faSelect = screen.getByRole("combobox", { name: "Free agent" });
    expect(faSelect).toHaveValue("10");
    expect(
      within(faSelect)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Wendell Carter Jr.", "Daniel Gafford"]);
    const mineSelect = screen.getByRole("combobox", { name: "Your player" });
    expect(mineSelect).toHaveValue("1");
    expect(
      within(mineSelect)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Isaiah Hartenstein", "Paul Reed"]);

    const faCard = cardOf({ label: "Free agent" });
    expect(within(faCard).getByText("0.94")).toBeInTheDocument();
    expect(within(faCard).getByText(/Wendell Carter Jr\./)).toBeInTheDocument();
    const mineCard = cardOf({ label: "Your team" });
    expect(within(mineCard).getByText("−0.42")).toBeInTheDocument();
    expect(within(mineCard).getByText(/Paul Reed/)).toBeInTheDocument();

    const table = screen.getByRole("table", {
      name: "Per-game categories, Wendell Carter Jr. vs Paul Reed",
    });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => (header.textContent ?? "").replace(/[▲▼]/g, ""));
    expect(headers).toEqual([
      "Wendell Carter Jr.",
      "Paul Reed",
      "Category",
      "Your team after swap",
    ]);
    rows.forEach((row) => {
      expect(cellsOf({ label: row.label })).toHaveLength(headers.length);
    });

    // FG%: my player wins it and the swap costs my team .002.
    expect(cellOf({ label: "FG%", column: "fa" }).textContent).toBe(".532");
    const mineFg = cellOf({ label: "FG%", column: "mine" });
    expect(within(mineFg).getByText("wins")).toHaveClass("srOnly");
    expect(mineFg.textContent).toContain("✓");
    expect(cellOf({ label: "FG%", column: "delta" }).textContent).toBe("−.002 worse");

    // REB: the free agent wins it and the swap adds 3.3.
    const faReb = cellOf({ label: "REB", column: "fa" });
    expect(faReb.textContent).toContain("8.2");
    expect(faReb.textContent).toContain("✓");
    expect(within(faReb).getByText("wins")).toHaveClass("srOnly");
    expect(cellOf({ label: "REB", column: "mine" }).textContent).toBe("4.9");
    expect(cellOf({ label: "REB", column: "delta" }).textContent).toBe("+3.3 better");
    expect(
      barHalves({ label: "REB" }).map((width) => Math.round(Number.parseFloat(width))),
    ).toEqual([63, 37]);

    // 3PTM: nobody wins, nothing moves, and the bar splits evenly.
    expect(cellOf({ label: "3PTM", column: "fa" }).textContent).toBe("0.0");
    expect(cellOf({ label: "3PTM", column: "mine" }).textContent).toBe("0.0");
    expect(cellOf({ label: "3PTM", column: "delta" }).textContent).toBe("0");
    expect(barHalves({ label: "3PTM" })).toEqual(["50%", "50%"]);

    expect(screen.getByText(headToHeadSummary({ pair, result }))).toBeInTheDocument();
  });

  it("formats percentages as rates and counts to one decimal", () => {
    renderPanel();

    expect(cellOf({ label: "FG%", column: "fa" }).textContent).toBe(".532");
    expect(cellOf({ label: "PTS", column: "fa" }).textContent).toContain("11.8");
    expect(cellOf({ label: "PTS", column: "mine" }).textContent).toBe("6.4");
  });

  it("prints a team change that rounds to nothing as 0 with no verdict", () => {
    renderPanel();

    expect(cellOf({ label: "AST", column: "delta" }).textContent).toBe("0");
    expect(cellOf({ label: "FT%", column: "delta" }).textContent).toBe("0");
  });

  it("asks for a pick when there is no pair", () => {
    renderPanel({ withPair: false });

    expect(
      screen.getByText("Pick a free agent and one of your players to compare."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Free agent" })).toBeInTheDocument();
  });

  it("says no free agent matches when the free pool is empty", () => {
    renderPanel({ withPair: false, freePool: [] });

    expect(screen.getByText("No free agents match this range and position.")).toBeInTheDocument();
    expect(
      screen.queryByText("Pick a free agent and one of your players to compare."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Free agent" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Your player" })).toBeInTheDocument();
  });

  it("updates the URL when a select changes", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPanel();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Free agent" }),
      "Daniel Gafford",
    );
    expect(onPick).toHaveBeenLastCalledWith({ fa: 11 });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Your player" }),
      "Isaiah Hartenstein",
    );
    expect(onPick).toHaveBeenLastCalledWith({ mine: 2 });
    expect(onPick).toHaveBeenCalledTimes(2);
  });
});

describe("HeadToHeadPanel sorting", () => {
  const categories = (): string[] =>
    screen.getAllByRole("rowheader").map((cell) => cell.textContent ?? "");
  type HeaderProps = { name: string | RegExp };

  const header = ({ name }: HeaderProps): HTMLElement => screen.getByRole("columnheader", { name });

  const renderSortable = () =>
    render(
      <HeadToHeadPanel
        pair={pair}
        result={result}
        freePool={[carter, gafford]}
        roster={[reed, hartenstein]}
        onPick={vi.fn()}
      />,
    );

  it("opens in the model's category order", () => {
    renderSortable();
    expect(categories().slice(0, 3)).toEqual(["FG%", "PTS", "REB"]);
  });

  it("sorts the categories by name, alphabetically first, then back to the model's order", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: /^Category/ })).getByRole("button"));
    expect(categories()).toEqual([...categories()].sort((a, b) => a.localeCompare(b)));
    expect(header({ name: /^Category/ })).toHaveAttribute("aria-sort", "ascending");

    await user.click(within(header({ name: /^Category/ })).getByRole("button"));
    await user.click(within(header({ name: /^Category/ })).getByRole("button"));
    expect(categories().slice(0, 3)).toEqual(["FG%", "PTS", "REB"]);
  });

  it("sorts by what the swap does to your team, biggest gain first", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: /^Your team after swap/ })).getByRole("button"));

    expect(categories().slice(0, 2)).toEqual(["PTS", "REB"]);
  });

  it("sorts by each player's number", async () => {
    const user = userEvent.setup();
    renderSortable();

    await user.click(within(header({ name: /^Wendell Carter Jr\./ })).getByRole("button"));
    expect(categories().at(0)).toBe("PTS");

    await user.click(within(header({ name: /^Paul Reed/ })).getByRole("button"));
    expect(categories().at(0)).toBe("PTS");
    expect(header({ name: /^Paul Reed/ })).toHaveAttribute("aria-sort", "descending");
    expect(header({ name: /^Wendell Carter Jr\./ })).not.toHaveAttribute("aria-sort");
  });

  it("right-aligns the free agent's and the team headers over their numbers", () => {
    renderSortable();
    expect(header({ name: /^Wendell Carter Jr\./ })).toHaveClass("numeric");
    expect(header({ name: /^Your team after swap/ })).toHaveClass("numeric");
    expect(header({ name: /^Category/ })).not.toHaveClass("numeric");
  });
});

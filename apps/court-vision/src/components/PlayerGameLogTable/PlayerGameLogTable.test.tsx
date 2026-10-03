import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import {
  PlayerGameLogTable,
  type PlayerGameLogTableProps,
  type PlayerGameLogTableRow,
} from "@/components/PlayerGameLogTable/PlayerGameLogTable";
import { type AdvancedMetricKey } from "@/lib/players/searchParams";

afterEach(cleanup);

const buildRow = (overrides: Partial<PlayerGameLogTableRow>): PlayerGameLogTableRow => ({
  id: "log-1",
  gameNumber: 1,
  gameDate: "2026-03-10T00:00:00.000Z",
  matchup: "MIA vs. WSH",
  winLoss: "W",
  teamScore: 118,
  opponentScore: 102,
  minutes: 42,
  fgm: 20,
  fga: 43,
  fg3m: 7,
  fg3a: 22,
  ftm: 36,
  fta: 43,
  oreb: 1,
  dreb: 8,
  reb: 9,
  ast: 3,
  stl: 2,
  blk: 2,
  tov: 5,
  pts: 83,
  plusMinus: 20,
  ...overrides,
});

const renderTable = ({
  rows,
  view,
  categories,
  searchParams = {},
  onUrlUpdate,
}: {
  rows: PlayerGameLogTableRow[];
  view?: PlayerGameLogTableProps["view"];
  categories?: PlayerGameLogTableProps["categories"];
  searchParams?: Record<string, string>;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
}) =>
  render(<PlayerGameLogTable rows={rows} view={view} categories={categories} />, {
    wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams, onUrlUpdate }),
  });

const advancedStats = (
  overrides: Partial<Record<AdvancedMetricKey, number | null>> = {},
): Record<AdvancedMetricKey, number | null> => ({
  pie: 0.18,
  pace: 99.5,
  assistPercentage: 0.25,
  assistRatio: 18,
  assistToTurnover: 2.5,
  defensiveRating: 108,
  defensiveReboundPercentage: 0.22,
  effectiveFieldGoalPercentage: 0.56,
  netRating: 5.2,
  offensiveRating: 113.2,
  offensiveReboundPercentage: 0.03,
  reboundPercentage: 0.12,
  trueShootingPercentage: 0.612,
  turnoverRatio: 11,
  usagePercentage: 0.31,
  ...overrides,
});

const columnNames = () =>
  screen
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.replace(/[↑↓↕]/g, "").trim());

describe("PlayerGameLogTable", () => {
  it("shows raw game stats in newest-first order", () => {
    renderTable({
      rows: [
        buildRow({ id: "older", gameDate: "2026-02-08T00:00:00.000Z", pts: 12 }),
        buildRow({ id: "newer" }),
      ],
    });

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("83")).toBeInTheDocument();
    expect(within(rows[2]).getByText("12")).toBeInTheDocument();
    expect(within(rows[1]).getByTitle("Miami Heat")).toHaveTextContent("MIA");
    expect(within(rows[1]).getByText("WSH")).toBeInTheDocument();
  });

  it("sorts every column, including points", () => {
    renderTable({
      rows: [
        buildRow({ id: "high", pts: 83 }),
        buildRow({ id: "low", pts: 12, gameDate: "2026-02-08T00:00:00.000Z" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /PTS/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("12")).toBeInTheDocument();
    expect(within(rows[2]).getByText("83")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("restores sorting from the URL and highlights the active column", () => {
    renderTable({
      rows: [
        buildRow({ id: "high", ast: 12 }),
        buildRow({ id: "low", ast: 3, gameDate: "2026-02-08T00:00:00.000Z" }),
      ],
      searchParams: { sort: "ast", dir: "desc" },
    });

    const rows = screen.getAllByRole("row");
    const astHeader = screen.getByRole("columnheader", { name: /AST/ });
    expect(within(rows[1]).getByText("12")).toBeInTheDocument();
    expect(astHeader).toHaveAttribute("aria-sort", "descending");
    expect(astHeader).toHaveAttribute("data-sort-active", "true");
    expect(rows[1].querySelectorAll('[data-sort-active="true"]')).toHaveLength(1);
  });

  it("writes the selected sort and direction to the URL", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderTable({ rows: [buildRow({})], onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("button", { name: /AST/ }));
    await waitFor(() => expect(updates.at(-1)?.queryString).toBe("?sort=ast&dir=asc"));

    await user.click(screen.getByRole("button", { name: /AST/ }));
    await waitFor(() => expect(updates.at(-1)?.queryString).toBe("?sort=ast&dir=desc"));
  });

  it("colors wins and losses with the win/loss classes", () => {
    renderTable({
      rows: [
        buildRow({ id: "won", winLoss: "W" }),
        buildRow({ id: "lost", gameDate: "2026-03-11T00:00:00.000Z", winLoss: "L" }),
      ],
    });

    expect(screen.getByText("W").className).toMatch(/win/i);
    expect(screen.getByText("L").className).toMatch(/loss/i);
  });

  it("shows the game score next to the result", () => {
    renderTable({
      rows: [buildRow({ winLoss: "L", teamScore: 102, opponentScore: 118 })],
    });

    const resultCell = screen.getByText("L").closest("td");
    expect(resultCell).toHaveTextContent("L 102-118");
  });

  it("shows the game number and flags DNP games with a dot", () => {
    renderTable({
      rows: [
        buildRow({ id: "played", gameNumber: 71 }),
        buildRow({
          id: "sat-out",
          gameNumber: 72,
          gameDate: "2026-03-11T00:00:00.000Z",
          minutes: 0,
        }),
      ],
    });

    expect(screen.getByText("71")).toBeInTheDocument();
    const dnpRow = screen.getByText("72").closest("tr");
    expect(dnpRow?.querySelector('[aria-label="Did not play"]') ?? null).toBeInTheDocument();
    expect(screen.getAllByLabelText("Did not play")).toHaveLength(1);
  });

  it("omits the score when it is not recorded", () => {
    renderTable({
      rows: [buildRow({ teamScore: null, opponentScore: null })],
    });

    const resultCell = screen.getByText("W").closest("td");
    expect(resultCell).toHaveTextContent(/^W$/);
  });

  it("wraps the log in a disclosure that opens by default and names the game count", () => {
    const { container } = renderTable({
      rows: [buildRow({ id: "a" }), buildRow({ id: "b", gameDate: "2026-02-08T00:00:00.000Z" })],
    });

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(true);
    const summary = container.querySelector("summary");
    expect(summary).not.toBeNull();
    expect(within(summary ?? container).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Game log",
    );
    expect(summary).toHaveTextContent("2 games");
    expect(details?.querySelector("table")).not.toBeNull();
  });

  it("collapses when the summary is activated", () => {
    const { container } = renderTable({ rows: [buildRow({ id: "a" })] });

    const summary = container.querySelector("summary");
    fireEvent.click(summary ?? container);

    expect(container.querySelector("details")?.open).toBe(false);
  });
});

describe("PlayerGameLogTable advanced view", () => {
  it("swaps the box score for every advanced metric, after the game columns", () => {
    renderTable({ view: "advanced", rows: [buildRow({ advanced: advancedStats() })] });

    const names = columnNames();
    expect(names.slice(0, 5)).toEqual(["GM", "Date", "Matchup", "Result", "MIN"]);
    expect(names).toContain("PIE");
    expect(names).toContain("Net Rtg");
    expect(names).toContain("TS%");
    expect(names).not.toContain("FGM");
    expect(names).not.toContain("PTS");
  });

  it("reads shares as percentages, ratings to one decimal, and a missing row as a dash", () => {
    renderTable({
      view: "advanced",
      rows: [
        buildRow({ id: "with", advanced: advancedStats() }),
        buildRow({ id: "without", gameDate: "2026-02-08T00:00:00.000Z", advanced: null }),
      ],
    });

    const [, withRow, withoutRow] = screen.getAllByRole("row");
    expect(within(withRow).getByText("61.2%")).toBeInTheDocument();
    expect(within(withRow).getByText("5.2")).toBeInTheDocument();
    expect(within(withoutRow).getAllByText("—")).toHaveLength(15);
  });

  it("names each metric in full on its header", () => {
    renderTable({ view: "advanced", rows: [buildRow({ advanced: advancedStats() })] });

    expect(screen.getByRole("button", { name: "Net Rtg" })).toHaveAttribute("title", "Net Rating");
  });

  it("sorts by a metric with games missing it last", () => {
    renderTable({
      view: "advanced",
      rows: [
        buildRow({ id: "high", advanced: advancedStats({ netRating: 12 }) }),
        buildRow({ id: "none", gameDate: "2026-02-01T00:00:00.000Z", advanced: null }),
        buildRow({
          id: "low",
          gameDate: "2026-02-08T00:00:00.000Z",
          advanced: advancedStats({ netRating: -4 }),
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Net Rtg" }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("-4.0")).toBeInTheDocument();
    expect(within(rows[2]).getByText("12.0")).toBeInTheDocument();
    expect(within(rows[3]).getAllByText("—")).toHaveLength(15);
  });

  it("falls back to newest-first when the URL sorts by a column this view lacks", () => {
    renderTable({
      view: "advanced",
      rows: [buildRow({ advanced: advancedStats() })],
      searchParams: { sort: "fgm", dir: "asc" },
    });

    expect(screen.getByRole("columnheader", { name: "Date" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });
});

describe("PlayerGameLogTable fantasy view", () => {
  const categories: PlayerGameLogTableProps["categories"] = [
    { key: "pts", label: "PTS" },
    { key: "reb", label: "REB" },
  ];

  const fantasy = {
    z: 2.14,
    g: 1.8,
    rollingZ: 1.2,
    rollingG: -0.42,
    categories: { pts: 1.9, reb: -0.4 },
  };

  it("shows the game's value, its rolling value, and each included category's Z", () => {
    renderTable({ view: "fantasy", categories, rows: [buildRow({ fantasy })] });

    const names = columnNames();
    expect(names.slice(0, 5)).toEqual(["GM", "Date", "Matchup", "Result", "MIN"]);
    expect(names.slice(5)).toEqual(["Z", "G", "Roll Z", "Roll G", "PTS Z", "REB Z"]);
  });

  it("prints signed scores and marks the negative ones", () => {
    renderTable({ view: "fantasy", categories, rows: [buildRow({ fantasy })] });

    expect(screen.getByText("+2.1")).not.toHaveAttribute("data-negative");
    // Roll G (-0.42) and REB Z (-0.4) both print as -0.4.
    const negatives = screen.getAllByText("-0.4");
    expect(negatives).toHaveLength(2);
    negatives.forEach((cell) => expect(cell).toHaveAttribute("data-negative", "true"));
  });

  it("dashes a missed game's own value and its categories", () => {
    renderTable({
      view: "fantasy",
      categories,
      rows: [
        buildRow({
          minutes: 0,
          fantasy: { z: null, g: null, rollingZ: 0.6, rollingG: 0.5, categories: {} },
        }),
      ],
    });

    const [, row] = screen.getAllByRole("row");
    expect(within(row).getAllByText("—")).toHaveLength(4);
    expect(within(row).getByText("+0.6")).toBeInTheDocument();
  });

  it("explains each fantasy column on its header", () => {
    renderTable({ view: "fantasy", categories, rows: [buildRow({ fantasy })] });

    expect(screen.getByRole("button", { name: "Roll Z" })).toHaveAttribute(
      "title",
      "Z-Score over the 10 games ending here",
    );
    expect(screen.getByRole("button", { name: "PTS Z" })).toHaveAttribute(
      "title",
      "Points Z-Score for this game",
    );
  });
});

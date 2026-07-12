import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerGameLogTable,
  type PlayerGameLogTableRow,
} from "@/components/PlayerGameLogTable/PlayerGameLogTable";

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
  searchParams = {},
  onUrlUpdate,
}: {
  rows: PlayerGameLogTableRow[];
  searchParams?: Record<string, string>;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
}) =>
  render(<PlayerGameLogTable rows={rows} />, {
    wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams, onUrlUpdate }),
  });

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
});

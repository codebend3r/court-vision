import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PlayerGameLogTable,
  type PlayerGameLogTableRow,
} from "@/components/PlayerGameLogTable/PlayerGameLogTable";

afterEach(cleanup);

const buildRow = (overrides: Partial<PlayerGameLogTableRow>): PlayerGameLogTableRow => ({
  id: "log-1",
  gameDate: "2026-03-10T00:00:00.000Z",
  matchup: "MIA vs. WSH",
  winLoss: "W",
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

describe("PlayerGameLogTable", () => {
  it("shows raw game stats in newest-first order", () => {
    render(
      <PlayerGameLogTable
        rows={[
          buildRow({ id: "older", gameDate: "2026-02-08T00:00:00.000Z", pts: 12 }),
          buildRow({ id: "newer" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("83")).toBeInTheDocument();
    expect(within(rows[2]).getByText("12")).toBeInTheDocument();
  });

  it("sorts every column, including points", () => {
    render(
      <PlayerGameLogTable
        rows={[
          buildRow({ id: "high", pts: 83 }),
          buildRow({ id: "low", pts: 12, gameDate: "2026-02-08T00:00:00.000Z" }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /PTS/ }));

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("12")).toBeInTheDocument();
    expect(within(rows[2]).getByText("83")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
});

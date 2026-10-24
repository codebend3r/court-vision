import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { FantasyValueTable } from "@/components/FantasyValueTable/FantasyValueTable";
import { type FantasyTableRow } from "@/lib/valuation/fantasyRows";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { makeStatLine } from "@/lib/valuation/fixtures";
import { FANTASY_METHODS } from "@vision/sport-basketball/engine";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>(), owners: null });
});

afterEach(cleanup);

const row = ({
  playerId,
  z,
  g = z,
  points = 40,
  vorp = z,
  positional = z,
  sgp = z,
  sim = z,
  rank,
}: {
  playerId: number;
  z: number;
  g?: number;
  points?: number;
  vorp?: number;
  positional?: number;
  sgp?: number;
  sim?: number;
  rank: number;
}): FantasyTableRow => ({
  ...makeStatLine({ playerId }),
  rank,
  values: { playerId, z, g, points, vorp, positional, sgp, sim },
});

const defaultProps = {
  sort: "z" as const,
  dir: "desc" as const,
  onSort: vi.fn(),
};

const rows = [
  row({ playerId: 1, z: 2.4, g: 1.8, rank: 1 }),
  row({ playerId: 2, z: -1.2, g: -0.9, vorp: -2.2, rank: 2 }),
];

describe("FantasyValueTable", () => {
  it("renders one explicit column per method", () => {
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /G-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PL Linear/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "VORP" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pos VORP/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /SGP/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sim Value/ })).toBeInTheDocument();
    expect(screen.getAllByText("+2.4").length).toBeGreaterThan(0); // z (vorp/pos share it)
    expect(screen.getByText("+1.8")).toBeInTheDocument(); // g
  });

  it("prints PL Linear's points total without the plus sign the scores carry", () => {
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);
    expect(screen.getAllByText("40.0")).toHaveLength(rows.length);
    expect(screen.queryByText("+40.0")).not.toBeInTheDocument();
    expect(screen.getByText("-2.2")).toBeInTheDocument(); // vorp keeps its minus
  });

  it("does not render per-category columns", () => {
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);
    expect(screen.queryByRole("columnheader", { name: "PTS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "FT%" })).not.toBeInTheDocument();
  });

  it("flags negative scores", () => {
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);
    const negatives = document.querySelectorAll('td[data-negative="true"]');
    expect(negatives.length).toBeGreaterThanOrEqual(3); // z, g, vorp of player 2
  });

  it("exposes the active sort via aria-sort and emits sort changes", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} onSort={onSort} />);
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await user.click(screen.getByRole("button", { name: /G-Score/ }));
    expect(onSort).toHaveBeenCalledWith({ sort: "g" });
    await user.click(screen.getByRole("button", { name: /Pos VORP/ }));
    expect(onSort).toHaveBeenCalledWith({ sort: "pos" });
  });

  it("marks only the rows of players on one of your teams", () => {
    useRosteredStore.getState().hydrate({ playerIds: [2] });
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);

    const [marker, ...others] = screen.getAllByText("On your team");
    expect(others).toHaveLength(0);
    const row = marker?.closest("tr") ?? document.body;
    expect(within(row).getAllByRole("link")[0]).toHaveAttribute("href", "/players/2");
  });

  it("chips each row as a free agent or by the team that holds the player", () => {
    useRosteredStore
      .getState()
      .hydrate({ playerIds: [], owners: [{ playerId: 2, teamName: "Rivals", isMine: false }] });
    render(<FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />);

    const heldRow = screen.getByText("Rivals").closest("tr") ?? document.body;
    expect(within(heldRow).getAllByRole("link")[0]).toHaveAttribute("href", "/players/2");
    expect(screen.getAllByText("Free agent")).toHaveLength(rows.length - 1);
  });

  it("hides the rank column for name sorts", () => {
    const { rerender } = render(
      <FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} />,
    );
    expect(screen.getByTitle("Rank in the current sort")).toBeInTheDocument();
    rerender(
      <FantasyValueTable isSignedIn={false} {...defaultProps} rows={rows} sort="lastName" />,
    );
    expect(screen.queryByTitle("Rank in the current sort")).not.toBeInTheDocument();
  });
});

describe("FantasyValueTable header tooltips", () => {
  it("explains what each method is for, not just how it is computed", () => {
    render(
      <FantasyValueTable isSignedIn={false} rows={rows} sort="z" dir="desc" onSort={vi.fn()} />,
    );
    // One per method column.
    expect(screen.getAllByText("Why it matters")).toHaveLength(FANTASY_METHODS.length);
    expect(screen.getByText(/who is better/)).toBeInTheDocument();
    expect(screen.getByText(/would I actually lose by dropping him/)).toBeInTheDocument();
  });
});

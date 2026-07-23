import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FantasyValueTable,
  type FantasyTableRow,
} from "@/components/FantasyValueTable/FantasyValueTable";
import { makeStatLine } from "@/lib/valuation/fixtures";

afterEach(cleanup);

const row = ({
  playerId,
  z,
  g = z,
  points = 40,
  vorp = z,
  positional = z,
  rank,
}: {
  playerId: number;
  z: number;
  g?: number;
  points?: number;
  vorp?: number;
  positional?: number;
  rank: number;
}): FantasyTableRow => ({
  ...makeStatLine({ playerId }),
  rank,
  values: { playerId, z, g, points, vorp, positional },
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
    render(<FantasyValueTable {...defaultProps} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /G-Score/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Points/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "VORP" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Pos VORP/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /SGP/ })).toBeInTheDocument();
    expect(screen.getAllByText("+2.4").length).toBeGreaterThan(0); // z (vorp/pos share it)
    expect(screen.getByText("+1.8")).toBeInTheDocument(); // g
  });

  it("renders the blocked SGP column as placeholders with an explanation", () => {
    render(<FantasyValueTable {...defaultProps} rows={rows} />);
    expect(screen.getAllByText("—")).toHaveLength(2); // one per row
    expect(document.getElementById("fantasy-tip-sgp")).toHaveTextContent(/standings-gain/i);
  });

  it("does not render per-category columns", () => {
    render(<FantasyValueTable {...defaultProps} rows={rows} />);
    expect(screen.queryByRole("columnheader", { name: "PTS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "FT%" })).not.toBeInTheDocument();
  });

  it("flags negative scores", () => {
    render(<FantasyValueTable {...defaultProps} rows={rows} />);
    const negatives = document.querySelectorAll('td[data-negative="true"]');
    expect(negatives.length).toBeGreaterThanOrEqual(3); // z, g, vorp of player 2
  });

  it("exposes the active sort via aria-sort and emits sort changes", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<FantasyValueTable {...defaultProps} rows={rows} onSort={onSort} />);
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await user.click(screen.getByRole("button", { name: /G-Score/ }));
    expect(onSort).toHaveBeenCalledWith({ sort: "g" });
    await user.click(screen.getByRole("button", { name: /Pos VORP/ }));
    expect(onSort).toHaveBeenCalledWith({ sort: "pos" });
  });

  it("hides the rank column for name sorts", () => {
    const { rerender } = render(<FantasyValueTable {...defaultProps} rows={rows} />);
    expect(screen.getByTitle("Rank in the current sort")).toBeInTheDocument();
    rerender(<FantasyValueTable {...defaultProps} rows={rows} sort="lastName" />);
    expect(screen.queryByTitle("Rank in the current sort")).not.toBeInTheDocument();
  });
});

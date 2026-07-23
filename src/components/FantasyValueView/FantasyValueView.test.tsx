import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "vitest";

import { FantasyValueView } from "@/components/FantasyValueView/FantasyValueView";
import { makeStatLine } from "@/lib/valuation/fixtures";
import type { FantasyStatLine } from "@/lib/valuation/types";

afterEach(cleanup);

const line = (overrides: Partial<FantasyStatLine> & { playerId: number }): FantasyStatLine =>
  makeStatLine({
    firstName: `First${overrides.playerId}`,
    lastName: `Last${overrides.playerId}`,
    fullName: `First${overrides.playerId} Last${overrides.playerId}`,
    ...overrides,
  });

// Alpha: elite scorer, dreadful high-volume FT shooter. Beta: good scorer,
// elite FT shooter. With FT% active Beta outranks Alpha on Z-Score; punting
// FT% flips it.
const alpha = line({
  playerId: 1,
  firstName: "Alpha",
  lastName: "Big",
  fullName: "Alpha Big",
  pts: 1400,
  ftm: 100,
  fta: 300,
});
const beta = line({
  playerId: 2,
  firstName: "Beta",
  lastName: "Guard",
  fullName: "Beta Guard",
  pts: 1100,
  ftm: 280,
  fta: 300,
});
const fillers = [3, 4, 5, 6].map((playerId) => line({ playerId }));
const lines = [alpha, beta, ...fillers];

const renderView = ({ searchParams = "?" }: { searchParams?: string } = {}) =>
  render(<FantasyValueView lines={lines} />, {
    wrapper: withNuqsTestingAdapter({ searchParams }),
  });

const firstDataRow = (): HTMLElement => {
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  const first = rows[1];
  if (first === undefined) throw new Error("no data rows rendered");
  return first;
};

describe("FantasyValueView", () => {
  it("renders every player sorted by Z-Score descending by default", () => {
    renderView();
    expect(screen.getByText("Showing 1–6 of 6")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Z-Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(within(firstDataRow()).getByText("Beta")).toBeInTheDocument();
  });

  it("re-ranks the Z-Score sort when FT% is punted via its chip", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Punt FT%" }));
    expect(within(firstDataRow()).getByText("Alpha")).toBeInTheDocument();
  });

  it("sorts by another method column on header click", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /Points/ }));
    expect(screen.getByRole("columnheader", { name: /Points/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    // Alpha's 28 points per game lead the Points column despite the FT drag.
    expect(within(firstDataRow()).getByText("Alpha")).toBeInTheDocument();
  });

  it("filters by the q param client-side", () => {
    renderView({ searchParams: "?q=Alpha" });
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("clamps an out-of-range page", () => {
    renderView({ searchParams: "?page=99" });
    expect(screen.getAllByText("Page 1 of 1").length).toBeGreaterThan(0);
  });

  it("orders ties deterministically by playerId", () => {
    renderView({ searchParams: "?q=First" }); // the four identical fillers
    const table = screen.getByRole("table");
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("link")[0]?.textContent ?? "");
    expect(names).toEqual(["First3", "First4", "First5", "First6"]);
  });

  it("notices a tiny pool and stays neutral", () => {
    render(<FantasyValueView lines={[alpha]} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?" }),
    });
    expect(screen.getByText(/pool is too small/i)).toBeInTheDocument();
  });

  it("prompts when every category is excluded", () => {
    renderView({ searchParams: "?x=pts,reb,ast,stl,blk,tpm,tov,fg,ft" });
    expect(screen.getByText(/add a category/i)).toBeInTheDocument();
  });

  it("renders the empty state without players", () => {
    render(<FantasyValueView lines={[]} />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?" }),
    });
    expect(screen.getByText(/No players yet/)).toBeInTheDocument();
  });
});

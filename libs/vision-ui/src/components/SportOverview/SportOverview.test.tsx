import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { basketballFixture } from "@vision/core/testing/basketballDescriptor";

import { SportOverview } from "#ui/components/SportOverview/SportOverview";

afterEach(cleanup);

describe("SportOverview", () => {
  it("lists every category with its kind and direction", () => {
    render(<SportOverview sport={basketballFixture} />);
    const categories = screen.getByRole("region", { name: "Scoring categories" });
    expect(within(categories).getAllByRole("row")).toHaveLength(1 + 9);
    const turnovers = within(categories).getByRole("rowheader", { name: "TOV" }).closest("tr");
    expect(turnovers).toHaveTextContent("Lower");
    const fieldGoals = within(categories).getByRole("rowheader", { name: "FG%" }).closest("tr");
    expect(fieldGoals).toHaveTextContent("Rate");
  });

  it("shows the points table with signed values", () => {
    render(<SportOverview sport={basketballFixture} />);
    const points = screen.getByRole("region", { name: "Points scoring" });
    expect(within(points).getByRole("rowheader", { name: "TOV" }).closest("tr")).toHaveTextContent(
      "-1",
    );
    expect(within(points).getByRole("rowheader", { name: "REB" }).closest("tr")).toHaveTextContent(
      "+1.2",
    );
  });

  it("shows which positions each roster slot takes", () => {
    render(<SportOverview sport={basketballFixture} />);
    const roster = screen.getByRole("region", { name: "Roster slots" });
    expect(within(roster).getByRole("rowheader", { name: "PG" }).closest("tr")).toHaveTextContent(
      "G",
    );
    expect(within(roster).getByRole("rowheader", { name: "UTIL" }).closest("tr")).toHaveTextContent(
      "Anyone",
    );
  });

  it("names each pool's categories when a sport splits its pool", () => {
    const sport = {
      ...basketballFixture,
      pools: [
        {
          ...basketballFixture.pools[0],
          key: "guards",
          label: "Guards",
          categories: ["pts" as const],
        },
        { ...basketballFixture.pools[0], key: "bigs", label: "Bigs", categories: ["reb" as const] },
      ] as const,
    };
    render(<SportOverview sport={sport} />);
    expect(screen.getByRole("region", { name: "Scoring categories: Guards" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scoring categories: Bigs" })).toBeInTheDocument();
  });
});

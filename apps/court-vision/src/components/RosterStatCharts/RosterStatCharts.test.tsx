import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { type ReactElement } from "react";

import { RosterStatCharts } from "@/components/RosterStatCharts/RosterStatCharts";
import { type RosterChart } from "@/lib/roster/charts";
import { type BarDatum, type StatDirection, type Tier } from "@/lib/roster/compare";

afterEach(cleanup);

const bar = ({
  id,
  name,
  label,
  tier,
}: {
  id: number;
  name: string;
  label: string;
  tier: Tier;
}): BarDatum => ({
  id,
  name,
  fullName: `A ${name}`,
  value: Number(label),
  label,
  percentile: 50,
  tier,
});

const chart = ({
  key,
  bars,
  direction = "high",
}: {
  key: string;
  bars: BarDatum[];
  direction?: StatDirection;
}): RosterChart => ({ key, label: key.toUpperCase(), fullName: `${key} full`, direction, bars });

const points = chart({
  key: "pts",
  bars: [
    bar({ id: 1, name: "Brunson", label: "28", tier: "strong" }),
    bar({ id: 2, name: "Hart", label: "9", tier: "weak" }),
  ],
});

// The bar plot is a next/dynamic chunk, and recharts dispatches store updates
// once it mounts. Render inside an async act so both settle before the test
// ends, otherwise React warns that those updates were not wrapped in act.
const renderCharts = async (ui: ReactElement) => {
  const result = render(ui);
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

describe("RosterStatCharts", () => {
  it("names the region and gives each stat a card", async () => {
    await renderCharts(<RosterStatCharts label="Regular stats charts" charts={[points]} />);
    const region = screen.getByRole("region", { name: "Regular stats charts" });
    expect(within(region).getByRole("heading", { name: /PTS/ })).toBeInTheDocument();
  });

  it("reads each chart out in words, best first, so it never rests on colour", async () => {
    await renderCharts(<RosterStatCharts label="Charts" charts={[points]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "pts full, best first: A Brunson 28, A Hart 9",
    );
  });

  it("keys only the colours the charts use", async () => {
    await renderCharts(<RosterStatCharts label="Charts" charts={[points]} />);
    const key = screen.getByRole("list", { name: "Colour key" });
    expect(within(key).getByText("Top third of the league")).toBeInTheDocument();
    expect(within(key).getByText("Bottom third")).toBeInTheDocument();
    expect(within(key).queryByText("Middle third")).not.toBeInTheDocument();
    expect(within(key).queryByText("Role, not quality")).not.toBeInTheDocument();
  });

  it("keys the role colour when a stat describes a role", async () => {
    const pace = chart({
      key: "pace",
      direction: "neutral",
      bars: [bar({ id: 1, name: "Brunson", label: "99", tier: "neutral" })],
    });
    await renderCharts(<RosterStatCharts label="Charts" charts={[pace]} />);
    expect(screen.getByText("Role, not quality")).toBeInTheDocument();
  });

  it("says so when a stat has no data, rather than drawing an empty chart", async () => {
    await renderCharts(
      <RosterStatCharts label="Charts" charts={[chart({ key: "blk", bars: [] })]} />,
    );
    expect(screen.getByText("No data yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

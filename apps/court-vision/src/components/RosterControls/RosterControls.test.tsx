import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { RosterControls } from "@/components/RosterControls/RosterControls";

afterEach(cleanup);

describe("RosterControls", () => {
  it("links every game range, keeping the tab and basis", () => {
    render(
      <RosterControls
        params={{ tab: "regular", range: "all", mode: "total", team: null }}
        showMode
      />,
    );
    const ranges = within(screen.getByRole("navigation", { name: "Game range" }));
    expect(ranges.getByRole("link", { name: "Last 10 games" })).toHaveAttribute(
      "href",
      "/roster?range=last10&mode=total",
    );
  });

  it("marks the current range and basis", () => {
    render(
      <RosterControls
        params={{ tab: "regular", range: "last5", mode: "average", team: null }}
        showMode
      />,
    );
    expect(screen.getByRole("link", { name: "Last 5 games" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Per game" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Totals" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the advanced tab when the range changes", () => {
    render(
      <RosterControls
        params={{ tab: "advanced", range: "all", mode: "average", team: null }}
        showMode={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Last 20 games" })).toHaveAttribute(
      "href",
      "/roster?tab=advanced&range=last20",
    );
  });

  it("offers no basis for advanced stats, which are all averages", () => {
    render(
      <RosterControls
        params={{ tab: "advanced", range: "all", mode: "average", team: null }}
        showMode={false}
      />,
    );
    expect(screen.queryByRole("navigation", { name: "Stat basis" })).not.toBeInTheDocument();
  });
});

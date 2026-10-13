import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ChartPanel } from "@/components/SeriesChart/ChartPanel";

afterEach(cleanup);

describe("ChartPanel", () => {
  it("titles its figure with a level-three heading", () => {
    render(
      <ChartPanel title="Shooting percentages">
        <p>chart</p>
      </ChartPanel>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Shooting percentages" })).toHaveClass(
      "panelTitle",
    );
    expect(screen.getByText("chart")).toBeInTheDocument();
  });
});

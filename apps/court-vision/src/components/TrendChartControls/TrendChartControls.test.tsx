import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { TrendChartControls } from "@/components/TrendChartControls/TrendChartControls";

afterEach(cleanup);

type RenderProps = { searchParams?: string };

const renderControls = ({ searchParams = "" }: RenderProps = {}) => {
  const onSpan = vi.fn();
  const onUrlUpdate = vi.fn();
  render(<TrendChartControls span="season" onSpan={onSpan} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }),
  });
  return {
    onSpan,
    onUrlUpdate,
    charts: within(screen.getByRole("group", { name: "Charts shown" })),
  };
};

describe("TrendChartControls", () => {
  it("starts with all seven charts on and hides one into the URL", async () => {
    const { charts, onUrlUpdate } = renderControls();

    expect(charts.getAllByRole("button", { pressed: true })).toHaveLength(7);
    fireEvent.click(charts.getByRole("button", { name: "SGP" }));
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ queryString: "?hide=sgp" }),
      ),
    );
  });

  it("will not hide the last chart, and offers to show them all again", async () => {
    const { charts, onUrlUpdate } = renderControls({
      searchParams: "?hide=g,points,vorp,positional,sgp,sim",
    });

    expect(charts.getByRole("button", { name: "Z-Score" })).toBeDisabled();
    fireEvent.click(charts.getByRole("button", { name: "Show all" }));
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(expect.objectContaining({ queryString: "" })),
    );
  });

  it("defaults the timeframe to the season and reports a new one", () => {
    const { onSpan } = renderControls();
    const timeframe = within(screen.getByRole("group", { name: "Timeframe" }));

    expect(timeframe.getByRole("button", { name: "Season" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(timeframe.getByRole("button", { name: "Last 10" }));
    expect(onSpan).toHaveBeenCalledWith("10");
  });

  it("carries the league-average switch", () => {
    renderControls();

    expect(screen.getByRole("checkbox", { name: "League average" })).toBeChecked();
  });
});

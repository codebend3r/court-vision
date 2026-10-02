import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { WatchlistTrendPlot } from "@/components/WatchlistTrendChart/WatchlistTrendPlot";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

afterEach(cleanup);

describe("WatchlistTrendPlot", () => {
  // happy-dom has no layout, so recharts draws no SVG here; the responsive
  // wrapper is what proves the plot mounted into its parent's box.
  it("mounts a responsive chart that fills its container", () => {
    const { container } = render(
      <ThemeProvider>
        <WatchlistTrendPlot
          rows={[{ date: Date.UTC(2026, 0, 1), p1: 0.4 }]}
          lines={[{ dataKey: "p1", name: "Jalen Brunson", endLabel: "Brunson", color: "#3987e5" }]}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});

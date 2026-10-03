import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import {
  lineColorFor,
  StandingsTrendPlot,
} from "@/components/StandingsTrendChart/StandingsTrendPlot";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

afterEach(cleanup);

describe("lineColorFor", () => {
  it("uses the team's primary color when it reads on the theme", () => {
    expect(lineColorFor({ abbr: "CHI", theme: "dark" })).toBe("#CE1141");
  });

  it("swaps a near-black primary for the secondary on the dark theme", () => {
    expect(lineColorFor({ abbr: "BKN", theme: "dark" })).toBe("#FFFFFF");
  });

  it("keeps a near-black primary on the light theme", () => {
    expect(lineColorFor({ abbr: "BKN", theme: "light" })).toBe("#000000");
  });
});

describe("StandingsTrendPlot", () => {
  // happy-dom has no layout, so recharts draws no SVG here; the responsive
  // wrapper is what proves the plot mounted into its parent's box.
  it("mounts a responsive chart that fills its container", () => {
    const { container } = render(
      <ThemeProvider>
        <StandingsTrendPlot
          teams={[{ abbr: "BOS", name: "Boston Celtics" }]}
          rows={[{ game: 1, BOS: 1 }]}
          active={null}
          onHover={() => undefined}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });
});

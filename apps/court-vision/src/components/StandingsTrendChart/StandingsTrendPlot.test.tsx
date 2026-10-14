import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import {
  lineColorFor,
  StandingsTrendPlot,
} from "@/components/StandingsTrendChart/StandingsTrendPlot";
import { ThemeProvider, type Theme } from "@vision/ui/components/ThemeProvider/ThemeProvider";
import { NBA_TEAMS } from "@/lib/teams/meta";

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

  it("swaps a near-black primary on every dark-toned theme, high contrast included", () => {
    expect(lineColorFor({ abbr: "BKN", theme: "high-contrast" })).toBe("#FFFFFF");
    expect(lineColorFor({ abbr: "BKN", theme: "amber-crt" })).toBe("#FFFFFF");
    expect(lineColorFor({ abbr: "BKN", theme: "colorblind-safe" })).toBe("#FFFFFF");
    expect(lineColorFor({ abbr: "BKN", theme: "team-accent" })).toBe("#FFFFFF");
  });

  it("swaps only BKN on a dark theme and no team on the light one", () => {
    const swapped = ({ theme }: { theme: Theme }) =>
      NBA_TEAMS.filter(
        (team) => lineColorFor({ abbr: team.abbreviation, theme }) !== team.primary,
      ).map((team) => team.abbreviation);

    expect(swapped({ theme: "dark" })).toEqual(["BKN"]);
    expect(swapped({ theme: "light" })).toEqual([]);
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

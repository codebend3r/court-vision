import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdvancedStatsLegend } from "@/components/AdvancedStatsLegend/AdvancedStatsLegend";
import { ADVANCED_STAT_META } from "@/lib/players/advancedStatMeta";

afterEach(cleanup);

describe("AdvancedStatsLegend", () => {
  it("renders the disclosure summary", () => {
    render(<AdvancedStatsLegend />);

    expect(screen.getByText("What do these stats mean?")).toBeInTheDocument();
  });

  it("lists every advanced stat with its full name and formula once expanded", () => {
    const { container } = render(<AdvancedStatsLegend />);

    const details = container.querySelector("details");
    if (!(details instanceof HTMLDetailsElement)) {
      throw new Error("legend <details> not rendered");
    }
    details.open = true;

    ADVANCED_STAT_META.map((meta) => {
      expect(within(details).getByText(meta.label)).toBeInTheDocument();
      expect(within(details).getByText(`${meta.fullName}.`)).toBeInTheDocument();
      expect(within(details).getByText(meta.formula)).toBeInTheDocument();
    });
  });
});

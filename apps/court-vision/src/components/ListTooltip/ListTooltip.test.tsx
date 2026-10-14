import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ListTooltip } from "@/components/ListTooltip/ListTooltip";

afterEach(cleanup);

describe("ListTooltip", () => {
  it("lists each line's name and value under the title", () => {
    render(
      <ListTooltip
        title="Game 12"
        entries={[
          { key: "BOS", name: "Boston Celtics", color: "#007A33", value: "9" },
          { key: "NYK", name: "New York Knicks", color: "#006BB6", value: "—" },
        ]}
      />,
    );

    expect(screen.getByText("Game 12")).toHaveClass("tooltipDate");
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Boston Celtics")).toBeInTheDocument();
    expect(within(rows[0]).getByText("9")).toHaveClass("tooltipValue");
    expect(within(rows[1]).getByText("—")).toBeInTheDocument();
  });

  it("counts the trimmed lines only when there are some", () => {
    const entries = [{ key: "BOS", name: "Boston Celtics", value: "9" }];
    const { rerender } = render(<ListTooltip title="Game 1" entries={entries} />);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();

    rerender(<ListTooltip title="Game 1" entries={entries} more={3} />);
    expect(screen.getByText("+3 more")).toHaveClass("tooltipMore");
  });
});

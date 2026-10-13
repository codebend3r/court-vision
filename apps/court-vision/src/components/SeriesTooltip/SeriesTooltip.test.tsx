import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { SeriesTooltip } from "@/components/SeriesTooltip/SeriesTooltip";

afterEach(cleanup);

describe("SeriesTooltip", () => {
  it("lists each series under the header with its colour dot", () => {
    const { container } = render(
      <SeriesTooltip
        header="Game 3"
        rows={[
          { key: "z", label: "Z-Score", color: "#3987e5", value: "+1.4" },
          { key: "g", label: "G-Score", color: "#199e70", value: "—" },
        ]}
      />,
    );

    expect(screen.getByText("Game 3")).toHaveClass("tooltipHeader");
    expect(screen.getByText("Z-Score: +1.4")).toHaveClass("tooltipRow");
    expect(screen.getByText("G-Score: —")).toBeInTheDocument();
    expect(container.querySelector(".dot")).toHaveStyle({ backgroundColor: "#3987e5" });
  });

  it("adds the status footnote only when given one", () => {
    const { rerender } = render(<SeriesTooltip header="Game 1" rows={[]} />);
    expect(screen.queryByText(/DNP/)).not.toBeInTheDocument();

    rerender(<SeriesTooltip header="Game 1" rows={[]} status="DNP / DNP-CD (0 MIN)" />);
    expect(screen.getByText("DNP / DNP-CD (0 MIN)")).toHaveClass("tooltipStatus");
  });
});

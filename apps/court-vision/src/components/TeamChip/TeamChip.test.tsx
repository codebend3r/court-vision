import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { TeamChip } from "@/components/TeamChip/TeamChip";

afterEach(cleanup);

describe("TeamChip", () => {
  it("renders only the abbreviation with team colors and contrasting text", () => {
    render(
      <>
        <TeamChip team="TOR" />
        <TeamChip team="SAS" />
      </>,
    );

    const raptors = screen.getByText("TOR");
    expect(raptors).toHaveStyle({ backgroundColor: "#CE1141", color: "#FFFFFF" });
    expect(raptors).toHaveAttribute("title", "Toronto Raptors");
    expect(raptors).toHaveAccessibleName("Toronto Raptors");
    expect(screen.getByText("SAS")).toHaveStyle({ backgroundColor: "#C4CED4", color: "#000000" });
    expect(screen.queryByText("Toronto Raptors")).not.toBeInTheDocument();
  });

  it("renders a neutral chip for an abbreviation it does not know", () => {
    render(<TeamChip team="SEA" />);

    const chip = screen.getByText("SEA");
    expect(chip).not.toHaveAttribute("title");
    expect(chip).not.toHaveAttribute("style");
  });
});

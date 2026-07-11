import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NBA_TEAMS, TeamChip } from "@/components/TeamChip/TeamChip";

afterEach(cleanup);

describe("TeamChip", () => {
  it("renders only the abbreviation with team colors for background, border, and text", () => {
    render(<TeamChip team="TOR" />);

    const chip = screen.getByText("TOR");
    expect(chip).toHaveStyle({ backgroundColor: "#CE1141", color: "#000000" });
    expect(chip).toHaveAttribute("title", "Toronto Raptors");
    expect(chip).toHaveAccessibleName("Toronto Raptors");
    expect(screen.queryByText("Toronto Raptors")).not.toBeInTheDocument();
  });

  it("defines all 30 NBA teams once", () => {
    expect(NBA_TEAMS).toHaveLength(30);
    expect(new Set(NBA_TEAMS.map((team) => team.abbreviation))).toHaveLength(30);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NBA_TEAMS, TeamChip } from "@/components/TeamChip/TeamChip";

afterEach(cleanup);

describe("TeamChip", () => {
  it("renders a team abbreviation, name, and two-color swatch", () => {
    render(<TeamChip team="TOR" />);

    expect(screen.getByText("TOR")).toBeInTheDocument();
    expect(screen.getByText("Toronto Raptors")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Toronto Raptors colors" })).toHaveStyle({
      background: "linear-gradient(135deg, #CE1141 0 50%, #000000 50% 100%)",
    });
  });

  it("defines all 30 NBA teams once", () => {
    expect(NBA_TEAMS).toHaveLength(30);
    expect(new Set(NBA_TEAMS.map((team) => team.abbreviation))).toHaveLength(30);
  });
});

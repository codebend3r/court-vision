import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TeamMatchup } from "@/components/TeamMatchup/TeamMatchup";

afterEach(cleanup);

describe("TeamMatchup", () => {
  it("renders a chip per team around a home separator", () => {
    render(<TeamMatchup matchup="GSW vs. LAL" />);

    expect(screen.getByTitle("Golden State Warriors")).toHaveTextContent("GSW");
    expect(screen.getByTitle("Los Angeles Lakers")).toHaveTextContent("LAL");
    expect(screen.getByText("vs.")).toBeInTheDocument();
  });

  it("renders a chip per team around an away separator", () => {
    render(<TeamMatchup matchup="TOR @ BOS" />);

    expect(screen.getByTitle("Toronto Raptors")).toHaveTextContent("TOR");
    expect(screen.getByTitle("Boston Celtics")).toHaveTextContent("BOS");
    expect(screen.getByText("@")).toBeInTheDocument();
  });

  it("falls back to a neutral chip for an unknown abbreviation", () => {
    render(<TeamMatchup matchup="MIA vs. WSH" />);

    expect(screen.getByTitle("Miami Heat")).toHaveTextContent("MIA");
    const unknown = screen.getByText("WSH");
    expect(unknown).not.toHaveAttribute("title");
    expect(unknown).not.toHaveAttribute("style");
  });

  it("renders the raw text when the matchup cannot be parsed", () => {
    render(<TeamMatchup matchup="vs. OPP1" />);

    expect(screen.getByText("vs. OPP1")).toBeInTheDocument();
  });
});

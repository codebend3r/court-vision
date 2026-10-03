import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ReadoutCard, ReadoutRow } from "@/components/ReadoutCard/ReadoutCard";

afterEach(cleanup);

describe("ReadoutCard", () => {
  it("renders label, value, and note", () => {
    render(<ReadoutCard label="Watchlist" value="18" note="of 50 slots" />);
    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("of 50 slots")).toBeInTheDocument();
  });

  it("marks the note with its sentiment", () => {
    render(<ReadoutCard label="Team Z-Score" value="+42.6" note="up 3.1" sentiment="up" />);
    expect(screen.getByText("up 3.1")).toHaveAttribute("data-sentiment", "up");
  });

  it("omits the note when not provided", () => {
    const { container } = render(<ReadoutCard label="Roster" value="9/13" />);
    expect(container.querySelectorAll("p").length).toBe(2);
  });

  it("wraps cards in the readout row", () => {
    render(
      <ReadoutRow>
        <ReadoutCard label="A" value="1" />
        <ReadoutCard label="B" value="2" />
      </ReadoutRow>,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});

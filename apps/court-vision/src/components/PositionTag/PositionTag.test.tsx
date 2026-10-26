import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { PlayerPositionText, PositionTag } from "@/components/PositionTag/PositionTag";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ positions: new Map<number, string>() });
});

afterEach(cleanup);

describe("PositionTag", () => {
  it("renders a single position group", () => {
    render(<PositionTag position="G" />);
    expect(screen.getByText("G")).toBeInTheDocument();
  });

  it("splits a hyphenated eligibility into separately-styled segments", () => {
    const { container } = render(<PositionTag position="G-F" />);
    // Each group renders in its own span, with a separator between them.
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    const guard = screen.getByText("G");
    const forward = screen.getByText("F");
    expect(guard.className).not.toBe(forward.className);
    expect(container.textContent).toBe("G-F");
  });

  it("splits Yahoo's comma-separated positions and colors each by its group", () => {
    const { container } = render(<PositionTag position="SG,SF,PF" />);

    expect(container.textContent).toBe("SG,SF,PF");
    expect(screen.getByText("SG").className).not.toBe(screen.getByText("SF").className);
    expect(screen.getByText("SF").className).toBe(screen.getByText("PF").className);
  });

  it("shows the league host's label for a player it knows", () => {
    useRosteredStore
      .getState()
      .hydrate({ playerIds: [], positions: [{ playerId: 5, position: "SG,SF,PF" }] });

    const { container } = render(<PositionTag position="G-F" playerId={5} />);

    expect(container.textContent).toBe("SG,SF,PF");
  });

  it("keeps the given position for a player the host does not know", () => {
    const { container } = render(<PositionTag position="G-F" playerId={99} />);

    expect(container.textContent).toBe("G-F");
  });
});

describe("PlayerPositionText", () => {
  it("renders the host's label, else the fallback, else a dash", () => {
    useRosteredStore
      .getState()
      .hydrate({ playerIds: [], positions: [{ playerId: 5, position: "PF,C" }] });

    const { container, rerender } = render(<PlayerPositionText playerId={5} position="F" />);
    expect(container.textContent).toBe("PF,C");

    rerender(<PlayerPositionText playerId={6} position="F" />);
    expect(container.textContent).toBe("F");

    rerender(<PlayerPositionText playerId={6} position={null} />);
    expect(container.textContent).toBe("-");
  });
});

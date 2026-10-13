import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";

import { RosteredMarker } from "@/components/RosteredMarker/RosteredMarker";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>() });
});

afterEach(cleanup);

describe("RosteredMarker", () => {
  it("names a player on one of your teams and exposes the row-tint hook", () => {
    useRosteredStore.getState().hydrate({ playerIds: [7] });

    render(<RosteredMarker playerId={7} />);

    expect(screen.getByText("On your team")).toHaveAttribute("data-on-your-team", "true");
  });

  it("renders nothing for a player on none of your teams", () => {
    useRosteredStore.getState().hydrate({ playerIds: [7] });

    const { container } = render(<RosteredMarker playerId={3} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("appears once a refresh adds the player to a team", () => {
    render(<RosteredMarker playerId={7} />);
    expect(screen.queryByText("On your team")).toBeNull();

    act(() => useRosteredStore.getState().hydrate({ playerIds: [7] }));

    expect(screen.getByText("On your team")).toBeInTheDocument();
  });
});

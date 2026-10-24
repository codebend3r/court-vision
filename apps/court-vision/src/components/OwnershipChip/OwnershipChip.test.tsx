import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { OwnershipChip } from "@/components/OwnershipChip/OwnershipChip";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>(), owners: null });
});

afterEach(cleanup);

const owners = [
  { playerId: 1, teamName: "Softchoice", isMine: true },
  { playerId: 2, teamName: "Rivals", isMine: false },
];

describe("OwnershipChip", () => {
  it("renders nothing while ownership is unknown", () => {
    const { container } = render(<OwnershipChip playerId={1} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks a player on no roster as a free agent", () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners });

    render(<OwnershipChip playerId={3} />);

    expect(screen.getByText("Free agent")).toHaveAttribute("data-ownership", "free");
  });

  it("names the league-mate's team holding the player", () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners });

    render(<OwnershipChip playerId={2} />);

    expect(screen.getByText("Rivals")).toHaveAttribute("data-ownership", "other");
  });

  it("names your own team", () => {
    useRosteredStore.getState().hydrate({ playerIds: [1], owners });

    render(<OwnershipChip playerId={1} />);

    expect(screen.getByText("Softchoice")).toHaveAttribute("data-ownership", "mine");
  });
});

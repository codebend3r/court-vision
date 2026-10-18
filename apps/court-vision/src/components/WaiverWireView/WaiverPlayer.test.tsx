import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { WaiverPlayer, type WaiverPlayerProps } from "@/components/WaiverWireView/WaiverPlayer";

afterEach(cleanup);

const player: WaiverPlayerProps["player"] = {
  playerId: 7,
  fullName: "Daniel Gafford",
  teamAbbr: "DAL",
  position: "C",
  owner: "waivers",
  injuryStatus: "Q",
};

const renderPlayer = ({
  overrides = {},
}: { overrides?: Partial<WaiverPlayerProps["player"]> } = {}) => {
  const onCompare = vi.fn<({ fa }: { fa: number }) => void>();
  render(
    <>
      <span id="compare-hint">Compare head-to-head against your weakest player</span>
      <WaiverPlayer
        player={{ ...player, ...overrides }}
        onCompare={onCompare}
        compareHintId="compare-hint"
      />
    </>,
  );
  return { onCompare };
};

describe("WaiverPlayer", () => {
  it("names a free agent with a button that opens head-to-head", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPlayer();

    await user.click(screen.getByRole("button", { name: "Daniel Gafford" }));

    expect(onCompare).toHaveBeenCalledWith({ fa: 7 });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("describes the name button with the shared compare hint", () => {
    renderPlayer();

    expect(screen.getByRole("button", { name: "Daniel Gafford" })).toHaveAccessibleDescription(
      "Compare head-to-head against your weakest player",
    );
  });

  it("links one of my players to their page", () => {
    renderPlayer({ overrides: { owner: "mine" } });

    expect(screen.getByRole("link", { name: "Daniel Gafford" })).toHaveAttribute(
      "href",
      "/players/7",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("links one of my players without a compare handler", () => {
    render(<WaiverPlayer player={{ ...player, owner: "mine" }} compareHintId="compare-hint" />);

    expect(screen.getByRole("link", { name: "Daniel Gafford" })).toHaveAttribute(
      "href",
      "/players/7",
    );
  });

  it("shows the team, position and status badges beside the name", () => {
    renderPlayer();

    expect(screen.getByText("DAL · C")).toBeInTheDocument();
    expect(screen.getByText("Questionable")).toBeInTheDocument();
    expect(screen.getByText("On waivers")).toBeInTheDocument();
  });

  it("leaves the meta line out when team and position are unknown", () => {
    renderPlayer({
      overrides: { teamAbbr: null, position: null, owner: "mine", injuryStatus: null },
    });

    expect(screen.getByRole("link").parentElement?.textContent ?? "").toBe("Daniel Gafford");
  });
});

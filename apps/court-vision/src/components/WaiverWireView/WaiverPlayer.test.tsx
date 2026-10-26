import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const starPlayer = vi.fn();
const unstarPlayer = vi.fn();

vi.mock("@/lib/watchlist/actions", () => ({ starPlayer, unstarPlayer }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/waiver-wire",
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { WaiverPlayer, type WaiverPlayerProps } from "@/components/WaiverWireView/WaiverPlayer";
import { useWatchlistStore } from "@/lib/watchlist/store";

beforeEach(() => {
  starPlayer.mockReset().mockResolvedValue({ status: "ok", count: 1 });
  unstarPlayer.mockReset().mockResolvedValue({ status: "ok", count: 0 });
  useWatchlistStore.setState({ playerIds: new Set<number>(), count: 0, lastError: null });
});

afterEach(cleanup);

const player: WaiverPlayerProps["player"] = {
  playerId: 7,
  fullName: "Daniel Gafford",
  teamAbbr: "DAL",
  position: "C",
  owner: "waivers",
  injuryStatus: "Q",
};

type RenderPlayerProps = { overrides?: Partial<WaiverPlayerProps["player"]> };

const renderPlayer = ({ overrides = {} }: RenderPlayerProps = {}) => {
  type OnCompareProps = { fa: number };

  const onCompare = vi.fn<({ fa }: OnCompareProps) => void>();
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
  it("links a free agent's name to their profile page", () => {
    renderPlayer();

    expect(screen.getByRole("link", { name: "Daniel Gafford" })).toHaveAttribute(
      "href",
      "/players/7",
    );
  });

  it("links one of my players' names to their profile page too", () => {
    renderPlayer({ overrides: { owner: "mine" } });

    expect(screen.getByRole("link", { name: "Daniel Gafford" })).toHaveAttribute(
      "href",
      "/players/7",
    );
  });

  it("clicking the name never opens head-to-head", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPlayer();

    await user.click(screen.getByRole("link", { name: "Daniel Gafford" }));

    expect(onCompare).not.toHaveBeenCalled();
  });

  it("opens head-to-head from a separate Compare button", async () => {
    const user = userEvent.setup();
    const { onCompare } = renderPlayer();

    await user.click(screen.getByRole("button", { name: "Compare Daniel Gafford head-to-head" }));

    expect(onCompare).toHaveBeenCalledWith({ fa: 7 });
  });

  it("describes the Compare button with the shared compare hint", () => {
    renderPlayer();

    expect(
      screen.getByRole("button", { name: "Compare Daniel Gafford head-to-head" }),
    ).toHaveAccessibleDescription("Compare head-to-head against your weakest player");
  });

  it("offers no Compare button for one of my players", () => {
    renderPlayer({ overrides: { owner: "mine" } });

    expect(screen.queryByRole("button", { name: /Compare/ })).not.toBeInTheDocument();
  });

  it("offers no Compare button without a compare handler", () => {
    render(<WaiverPlayer player={player} compareHintId="compare-hint" />);

    expect(screen.queryByRole("button", { name: /Compare/ })).not.toBeInTheDocument();
  });

  it("lets the user star the player from the table", async () => {
    const user = userEvent.setup();
    renderPlayer();

    await user.click(screen.getByRole("button", { name: "Star Daniel Gafford" }));

    expect(starPlayer).toHaveBeenCalledWith({ playerId: 7, leagueId: null });
    expect(screen.getByRole("button", { name: "Unstar Daniel Gafford" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("stars one of my players as well", () => {
    renderPlayer({ overrides: { owner: "mine" } });

    expect(screen.getByRole("button", { name: "Star Daniel Gafford" })).toBeInTheDocument();
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

    const cell = screen.getByRole("link").parentElement;
    if (cell === null) throw new Error("no cell");
    expect(within(cell).queryByText(/·/)).not.toBeInTheDocument();
  });
});

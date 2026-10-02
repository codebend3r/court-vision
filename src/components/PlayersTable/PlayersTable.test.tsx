import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { type ComponentProps, createContext, use } from "react";

import { PlayersTable } from "@/components/PlayersTable/PlayersTable";
import { type PlayerRow } from "@/lib/players/search";
import { type AdvancedPlayerRow } from "@/lib/players/searchAdvanced";
import { buildPlayersHref, type PlayersSearchParams } from "@/lib/players/searchParams";

// The href whose navigation the test treats as in flight. Each mocked Link
// reports pending through useLinkStatus only when its href matches, the way
// next/link scopes the status to the one link that was clicked.
const PendingHref = createContext<string | null>(null);
const LinkStatus = createContext({ pending: false });

type MockLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  prefetch?: boolean | "auto" | null;
};

function MockLink({ href, prefetch, children, ...rest }: MockLinkProps) {
  const pendingHref = use(PendingHref);
  return (
    <LinkStatus value={{ pending: href === pendingHref }}>
      <a href={href} data-prefetch={String(prefetch ?? "auto")} {...rest}>
        {children}
      </a>
    </LinkStatus>
  );
}

vi.mock("next/link", () => ({
  default: MockLink,
  useLinkStatus: () => use(LinkStatus),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/players" }));
vi.mock("@/lib/watchlist/actions", () => ({ starPlayer: vi.fn(), unstarPlayer: vi.fn() }));

afterEach(cleanup);

const params: PlayersSearchParams = {
  q: "",
  page: 1,
  size: 50,
  sort: "pts",
  dir: "desc",
  range: "all",
  mode: "average",
  minimums: true,
  tab: "regular",
};

const curry: PlayerRow = {
  id: 1,
  firstName: "Stephen",
  lastName: "Curry",
  fullName: "Stephen Curry",
  teamAbbr: "GSW",
  position: "G",
  nbaPersonId: null,
  stats: {
    gamesPlayed: 10,
    fgm: 90,
    fga: 190,
    fg3m: 45,
    fg3a: 110,
    ftm: 50,
    fta: 55,
    reb: 50,
    ast: 60,
    stl: 12,
    blk: 4,
    tov: 30,
    pts: 275,
  },
};

const renderRegular = ({ pendingHref = null }: { pendingHref?: string | null } = {}) =>
  render(
    <PendingHref value={pendingHref}>
      <PlayersTable variant="regular" rows={[curry]} params={params} page={1} isSignedIn={false} />
    </PendingHref>,
  );

const headerLinks = () =>
  within(screen.getAllByRole("rowgroup")[0] ?? document.body).getAllByRole("link");

describe("PlayersTable", () => {
  it("never prefetches the sort header links", () => {
    renderRegular();

    const links = headerLinks();
    expect(links.length).toBeGreaterThan(1);
    expect(links.every((link) => link.getAttribute("data-prefetch") === "false")).toBe(true);
  });

  it("leaves the player row links on the default prefetch", () => {
    renderRegular();

    expect(screen.getByRole("link", { name: "Stephen Curry" })).toHaveAttribute(
      "data-prefetch",
      "auto",
    );
  });

  it("shows no pending cue while no sort is in flight", () => {
    const { container } = renderRegular();

    expect(container.querySelector("thead [data-pending]")).toBeNull();
    expect(screen.getAllByRole("status").every((status) => status.textContent === "")).toBe(true);
  });

  it("marks only the clicked sort header pending and announces the sort", () => {
    const rebHref = buildPlayersHref({ ...params, page: 1, sort: "reb", dir: "desc" });
    renderRegular({ pendingHref: rebHref });

    const rebLink = screen.getByRole("link", { name: /^REB/ });
    expect(rebLink).toHaveAttribute("href", rebHref);
    expect(rebLink.querySelector("[data-pending='true']")).toHaveAttribute("aria-hidden", "true");
    expect(within(rebLink).getByRole("status")).toHaveTextContent("Sorting by REB, descending");

    const ptsLink = screen.getByRole("link", { name: /^PTS/ });
    expect(ptsLink.querySelector("[data-pending]")).toBeNull();
    expect(within(ptsLink).getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces the flipped direction when the active column is re-sorted", () => {
    const ptsHref = buildPlayersHref({ ...params, page: 1, sort: "pts", dir: "asc" });
    renderRegular({ pendingHref: ptsHref });

    const ptsLink = screen.getByRole("link", { name: /^PTS/ });
    expect(within(ptsLink).getByRole("status")).toHaveTextContent("Sorting by PTS, ascending");
  });

  it("announces an advanced column by its full name", () => {
    const advancedParams: PlayersSearchParams = { ...params, sort: "lastName", tab: "advanced" };
    const rows: AdvancedPlayerRow[] = [];
    const pieHref = buildPlayersHref({ ...advancedParams, page: 1, sort: "pie", dir: "desc" });
    render(
      <PendingHref value={pieHref}>
        <PlayersTable
          variant="advanced"
          rows={rows}
          params={advancedParams}
          page={1}
          isSignedIn={false}
        />
      </PendingHref>,
    );

    const pieLink = screen.getByRole("link", { name: /^PIE/ });
    expect(pieLink).toHaveAttribute("data-prefetch", "false");
    expect(within(pieLink).getByRole("status")).toHaveTextContent(
      "Sorting by Player Impact Estimate, descending",
    );
  });
});

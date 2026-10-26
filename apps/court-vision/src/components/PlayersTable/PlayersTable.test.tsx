import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { type ComponentProps, createContext, use } from "react";

import {
  ADVANCED_COLUMNS,
  PlayersTable,
  regularColumns,
} from "@/components/PlayersTable/PlayersTable";
import { useRosteredStore } from "@/lib/leagues/rosteredStore";
import { type PlayerPoolRow } from "@/lib/players/search";
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

beforeEach(() => {
  useRosteredStore.setState({ playerIds: new Set<number>(), owners: null });
});

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
  owner: "all",
  tab: "regular",
};

const curry: PlayerPoolRow = {
  id: 1,
  firstName: "Stephen",
  lastName: "Curry",
  fullName: "Stephen Curry",
  teamAbbr: "GSW",
  position: "G",
  nbaPersonId: null,
  stats: {
    gamesPlayed: 10,
    min: 335,
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

type RenderRegularProps = { pendingHref?: string | null };

const renderRegular = ({ pendingHref = null }: RenderRegularProps = {}) =>
  render(
    <PendingHref value={pendingHref}>
      <PlayersTable
        rows={[curry]}
        columns={regularColumns({ mode: params.mode })}
        params={params}
        page={1}
        isSignedIn={false}
      />
    </PendingHref>,
  );

const headerLinks = () =>
  within(screen.getAllByRole("rowgroup")[0] ?? document.body).getAllByRole("link");

describe("PlayersTable ownership and minutes", () => {
  it("shows a free-agent chip in the player cell once the league's owners are known", () => {
    useRosteredStore.getState().hydrate({ playerIds: [], owners: [] });
    renderRegular();

    const row = screen.getByRole("row", { name: /Stephen Curry/ });
    expect(within(row).getByText("Free agent")).toBeInTheDocument();
  });

  it("shows no ownership chip while ownership is unknown", () => {
    renderRegular();

    expect(screen.queryByText("Free agent")).toBeNull();
  });

  it("shows minutes as a whole-number per-game average, or a rounded total", () => {
    const minutes = regularColumns({ mode: "average" }).find((column) => column.label === "MIN");
    const totals = regularColumns({ mode: "total" }).find((column) => column.label === "MIN");
    const row = { ...curry, stats: { ...curry.stats, min: 335, gamesPlayed: 10 } };

    expect(minutes?.cell(row)).toBe("34");
    expect(totals?.cell(row)).toBe("335");
    expect(minutes?.cell({ ...row, stats: { ...row.stats, gamesPlayed: 0 } })).toBe("—");
  });
});

describe("PlayersTable", () => {
  it("never prefetches the sort header links", () => {
    renderRegular();

    const links = headerLinks();
    expect(links.length).toBeGreaterThan(1);
    expect(links.every((link) => link.getAttribute("data-prefetch") === "false")).toBe(true);
  });

  it("marks a player on one of your teams inside their own row", () => {
    useRosteredStore.getState().hydrate({ playerIds: [curry.id] });
    renderRegular();

    const row = screen.getByRole("row", { name: /Stephen Curry/ });
    expect(within(row).getByText("On your team")).toHaveAttribute("data-on-your-team", "true");
  });

  it("leaves a player on none of your teams unmarked", () => {
    useRosteredStore.getState().hydrate({ playerIds: [999] });
    renderRegular();

    expect(screen.queryByText("On your team")).toBeNull();
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
          columns={ADVANCED_COLUMNS}
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

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SideNav } from "@/components/SideNav/SideNav";

const pathnameMock = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.current,
  useRouter: () => ({ refresh: () => {} }),
}));

afterEach(cleanup);

describe("SideNav", () => {
  it("groups research and league entries with settings pinned", () => {
    pathnameMock.current = "/";
    render(<SideNav />);
    expect(screen.getByRole("region", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "My league" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("renders every destination", () => {
    pathnameMock.current = "/";
    render(<SideNav />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/",
      "/players",
      "/teams",
      "/my-teams",
      "/roster",
      "/matchup",
      "/waiver-wire",
      "/advisor",
      "/leagues",
      "/watchlist",
      "/settings",
    ]);
  });

  it("marks the current section active", () => {
    pathnameMock.current = "/players";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Teams active on the team detail page", () => {
    pathnameMock.current = "/team";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Teams" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps Players active on a player detail page", () => {
    pathnameMock.current = "/players/1234";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute("aria-current", "page");
  });

  it("lights Roster on its own route and not Fantasy League", () => {
    pathnameMock.current = "/roster";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Roster" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Fantasy League" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("keeps Fantasy League active on nested my-team routes", () => {
    pathnameMock.current = "/my-teams/rim-protectors";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Fantasy League" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("lists the Waiver Wire in My league and marks it current on its page", () => {
    pathnameMock.current = "/waiver-wire";
    render(<SideNav />);
    const link = screen.getByRole("link", { name: "Waiver Wire" });
    expect(link).toHaveAttribute("href", "/waiver-wire");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(
      within(screen.getByRole("region", { name: "My league" })).getByRole("link", {
        name: "Waiver Wire",
      }),
    ).toBe(link);
  });

  it("keeps Leagues active on a league's own page", () => {
    pathnameMock.current = "/leagues/bench-mob";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Leagues" })).toHaveAttribute("aria-current", "page");
  });

  it("lights exactly one entry, and never Home off the root", () => {
    pathnameMock.current = "/players/1234";
    render(<SideNav />);
    expect(
      screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page"),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("does not light a section for a route that merely shares its prefix", () => {
    // /team is Teams' alias, but /teams must not light it twice, and /my-teams
    // must not light Teams at all.
    pathnameMock.current = "/my-teams";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Teams" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Fantasy League" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

import { cleanup, render, screen } from "@testing-library/react";
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

  it("keeps My Teams active on nested my-team routes", () => {
    pathnameMock.current = "/my-teams/rim-protectors";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "My Teams" })).toHaveAttribute("aria-current", "page");
  });
});

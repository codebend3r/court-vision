import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SideNav } from "@/components/SideNav/SideNav";
import { useSideNavStore } from "@/components/SideNav/sideNavStore";

const pathnameMock = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.current,
}));

beforeEach(() => {
  localStorage.clear();
  useSideNavStore.setState({ isCollapsed: false });
});

afterEach(cleanup);

describe("SideNav", () => {
  it("renders the Players link", () => {
    pathnameMock.current = "/";
    render(<SideNav />);
    const link = screen.getByRole("link", { name: "Players" });
    expect(link).toHaveAttribute("href", "/players");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks Players active on /players", () => {
    pathnameMock.current = "/players";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Players" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the Design link", () => {
    pathnameMock.current = "/";
    render(<SideNav />);
    const link = screen.getByRole("link", { name: "Design" });
    expect(link).toHaveAttribute("href", "/design");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("marks Design active on /design", () => {
    pathnameMock.current = "/design";
    render(<SideNav />);
    expect(screen.getByRole("link", { name: "Design" })).toHaveAttribute("aria-current", "page");
  });

  it("collapses the side menu and persists the state", () => {
    render(<SideNav />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse side menu" }));

    expect(screen.getByRole("navigation", { name: "Site" })).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Expand side menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(localStorage.getItem("court-vision-side-nav")).toContain('"isCollapsed":true');
  });

  it("rehydrates a saved collapsed state", async () => {
    localStorage.setItem(
      "court-vision-side-nav",
      JSON.stringify({ state: { isCollapsed: true }, version: 0 }),
    );

    render(<SideNav />);

    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: "Site" })).toHaveAttribute(
        "data-collapsed",
        "true",
      ),
    );
  });
});

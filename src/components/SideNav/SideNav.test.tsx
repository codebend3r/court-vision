import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SideNav } from "./SideNav";

const pathnameMock = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.current,
}));

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
});

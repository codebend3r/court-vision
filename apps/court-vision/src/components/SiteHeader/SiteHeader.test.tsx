import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const getProfile = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));
// The signed-in header renders LeagueSwitcher, which reads the app router.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: () => {} }),
}));

import { SiteHeader } from "@/components/SiteHeader/SiteHeader";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

beforeEach(() => getProfile.mockReset());

async function renderHeader() {
  render(<ThemeProvider>{await SiteHeader()}</ThemeProvider>);
}

describe("SiteHeader", () => {
  it("renders the logo lockup linking home", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    const home = screen.getByRole("link", { name: "Court Vision" });
    expect(home).toHaveAttribute("href", "/");
  });

  it("keeps the mark decorative inside the home link", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    const home = screen.getByRole("link", { name: "Court Vision" });
    expect(home.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the six-theme swatch strip", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    const strip = screen.getByRole("group", { name: "Theme" });
    expect(strip.querySelectorAll("button").length).toBe(6);
  });

  it("shows a sign-in link when signed out", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows the @username menu when signed in", async () => {
    getProfile.mockResolvedValue({ username: "steve" });
    await renderHeader();
    expect(screen.getByRole("button", { name: /@steve/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });
});

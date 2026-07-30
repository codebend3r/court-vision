import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const getProfile = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));

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
  it("renders the Court Vision wordmark linking home", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    const wordmark = screen.getByRole("link", { name: "Court Vision" });
    expect(wordmark).toHaveAttribute("href", "/");
  });

  it("renders the logo mark as decorative inside the home link", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    const wordmark = screen.getByRole("link", { name: "Court Vision" });
    const mark = wordmark.querySelector("img");
    expect(mark).toHaveAttribute("alt", "");
    expect(mark?.getAttribute("src") ?? "").toContain("court-vision-mark-cropped.png");
  });

  it("renders the theme toggle", async () => {
    getProfile.mockResolvedValue(null);
    await renderHeader();
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
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

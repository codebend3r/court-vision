import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getProfile: () => getProfile() }));

import Home from "@/app/page";

afterEach(cleanup);

beforeEach(() => getProfile.mockReset());

describe("Home", () => {
  it("shows sign-in prompts for Your Team and Watched Players when signed out", async () => {
    getProfile.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("heading", { name: "Your Team" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watched Players" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(2);
  });

  it("shows coming-soon empty states for Your Team and Watched Players when signed in", async () => {
    getProfile.mockResolvedValue({ username: "steve" });

    render(await Home());

    expect(screen.getByText("You haven't built a fantasy team yet.")).toBeInTheDocument();
    expect(screen.getByText("You aren't watching any players yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("always shows the stat trends placeholder regardless of auth state", async () => {
    getProfile.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("heading", { name: "Stat Trends to Watch" })).toBeInTheDocument();
    expect(screen.getByText(/Short on rebounds/)).toBeInTheDocument();
  });
});

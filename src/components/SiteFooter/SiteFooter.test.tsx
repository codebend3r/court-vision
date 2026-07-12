import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/SiteFooter/SiteFooter";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("SiteFooter", () => {
  it("shows the copyright with the current year", () => {
    render(<SiteFooter />);

    expect(screen.getByText(`© ${new Date().getFullYear()} CJ Rivas`)).toBeInTheDocument();
  });

  it("links the repo name to GitHub in a new tab", () => {
    render(<SiteFooter />);

    const link = screen.getByRole("link", { name: "codebend3r/court-vision" });
    expect(link).toHaveAttribute("href", "https://github.com/codebend3r/court-vision");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.querySelector("svg")).toBeInTheDocument();
  });

  it("shows the app version from the build environment", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "9.9.9");

    render(<SiteFooter />);

    expect(screen.getByText("v9.9.9")).toBeInTheDocument();
  });

  it("omits the version when the environment does not provide one", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");

    render(<SiteFooter />);

    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });
});

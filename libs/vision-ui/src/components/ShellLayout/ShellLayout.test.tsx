import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

// next/font only works under Next's compiler; stand in for the three faces.
const font = () => ({ className: "font", style: {}, variable: "font-variable" });

vi.mock("next/font/google", () => ({
  Chakra_Petch: font,
  IBM_Plex_Mono: font,
  IBM_Plex_Sans: font,
}));

// Imported after the mock: the real next/font/google has no runtime exports,
// so a static import would fail to link before the mock could install.
const { ShellLayout } = await import("#ui/components/ShellLayout/ShellLayout");

afterEach(cleanup);

describe("ShellLayout", () => {
  it("opens with the skip link, then the wordmark and theme strip, then the routes", () => {
    render(
      <ShellLayout lead="Rink">
        <main>Home</main>
      </ShellLayout>,
      { container: document },
    );

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    const target = document.getElementById("main-content");
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(target).toHaveAttribute("tabindex", "-1");
    expect(target).toContainElement(screen.getByRole("main"));
    expect(screen.getByRole("banner")).toHaveTextContent("RinkVision");
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });
});

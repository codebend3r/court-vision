import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { ThemeProvider, useTheme } from "@/lib/theme/ThemeProvider";

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span>{theme}</span>
      <button type="button" onClick={() => setTheme({ theme: "amber-crt" })}>
        pick amber
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

describe("ThemeProvider", () => {
  it("defaults to dark theme when no attribute is stamped", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText("dark")).toBeInTheDocument();
  });

  it("reads a pre-stamped light attribute as the initial theme", () => {
    document.documentElement.dataset.theme = "light";

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText("light")).toBeInTheDocument();
  });

  it("reads a pre-stamped six-theme attribute as the initial theme", () => {
    document.documentElement.dataset.theme = "colorblind-safe";

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText("colorblind-safe")).toBeInTheDocument();
  });

  it("falls back to dark when the stamped attribute is not a theme", () => {
    document.documentElement.dataset.theme = "sepia";

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByText("dark")).toBeInTheDocument();
  });

  it("sets theme state, the html attribute, and localStorage on pick", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "pick amber" }));

    expect(screen.getByText("amber-crt")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("amber-crt");
    expect(window.localStorage.getItem("theme")).toBe("amber-crt");
  });

  it("throws when useTheme is called outside a ThemeProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow("useTheme must be used within ThemeProvider");

    consoleError.mockRestore();
  });
});

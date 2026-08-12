import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ThemeSwatches } from "@/components/ThemeSwatches/ThemeSwatches";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

const renderStrip = () =>
  render(
    <ThemeProvider>
      <ThemeSwatches />
    </ThemeProvider>,
  );

describe("ThemeSwatches", () => {
  it("renders one labelled button per theme", () => {
    renderStrip();
    const group = screen.getByRole("group", { name: "Theme" });
    expect(group.querySelectorAll("button").length).toBe(6);
    expect(screen.getByRole("button", { name: "Switch to Amber CRT theme" })).toBeInTheDocument();
  });

  it("marks the active theme pressed", () => {
    renderStrip();
    expect(screen.getByRole("button", { name: "Switch to Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Switch to Light theme" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches the theme on click", () => {
    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Switch to High contrast theme" }));
    expect(document.documentElement.dataset.theme).toBe("high-contrast");
    expect(window.localStorage.getItem("theme")).toBe("high-contrast");
    expect(screen.getByRole("button", { name: "Switch to High contrast theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

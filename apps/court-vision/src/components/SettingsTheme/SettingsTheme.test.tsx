import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { SettingsTheme } from "@/components/SettingsTheme/SettingsTheme";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

const renderPanel = () =>
  render(
    <ThemeProvider>
      <SettingsTheme />
    </ThemeProvider>,
  );

describe("SettingsTheme", () => {
  it("renders six theme cards with their notes", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Theme" });
    expect(group.querySelectorAll("button").length).toBe(6);
    expect(screen.getByText("Blue and amber encoding — no red-green pairing.")).toBeInTheDocument();
  });

  it("marks the active theme card pressed", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^Dark/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies a theme on pick", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Amber CRT/ }));
    expect(document.documentElement.dataset.theme).toBe("amber-crt");
    expect(window.localStorage.getItem("theme")).toBe("amber-crt");
  });
});

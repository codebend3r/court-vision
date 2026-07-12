import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/lib/theme/ThemeProvider";

import { TokenSwatch } from "@/components/TokenSwatch/TokenSwatch";

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--color-bg");
});

describe("TokenSwatch", () => {
  it("shows the token name", () => {
    render(
      <ThemeProvider>
        <TokenSwatch token="--color-bg" />
      </ThemeProvider>,
    );

    expect(screen.getByText("--color-bg")).toBeInTheDocument();
  });

  it("shows the computed value read from the documentElement after the effect runs", () => {
    document.documentElement.style.setProperty("--color-bg", "#123456");

    render(
      <ThemeProvider>
        <TokenSwatch token="--color-bg" />
      </ThemeProvider>,
    );

    expect(screen.getByText("#123456")).toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { SettingsAppearance } from "@/components/SettingsAppearance/SettingsAppearance";

const updatePreferencesMock = vi.fn();

vi.mock("@/lib/settings/actions", () => ({
  updatePreferences: (args: { preferredFormula?: string | null; fontScale?: string }) =>
    updatePreferencesMock(args),
}));

beforeEach(() => {
  updatePreferencesMock.mockReset().mockResolvedValue({ status: "ok" });
  document.documentElement.dataset.fontScale = "default";
});

afterEach(cleanup);

describe("SettingsAppearance", () => {
  it("renders four keycaps labelled with their body px sizes", () => {
    render(<SettingsAppearance fontScale="default" />);
    ["Small 15px", "Default 16px", "Large 18px", "X-Large 20px"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("presses the keycap matching the fontScale prop", () => {
    render(<SettingsAppearance fontScale="lg" />);
    expect(screen.getByRole("button", { name: "Large 18px" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("carries data-font-scale on the preview region matching the pressed keycap", () => {
    render(<SettingsAppearance fontScale="lg" />);
    expect(screen.getByRole("region", { name: "Preview" })).toHaveAttribute(
      "data-font-scale",
      "lg",
    );
  });

  it("sets the document font scale and saves when X-Large is clicked", async () => {
    render(<SettingsAppearance fontScale="default" />);
    fireEvent.click(screen.getByRole("button", { name: "X-Large 20px" }));
    expect(document.documentElement.dataset.fontScale).toBe("xl");
    expect(updatePreferencesMock).toHaveBeenCalledWith({ fontScale: "xl" });
    expect(screen.getByRole("region", { name: "Preview" })).toHaveAttribute(
      "data-font-scale",
      "xl",
    );
    await waitFor(() => expect(updatePreferencesMock).toHaveBeenCalledTimes(1));
  });

  it("reverts the attribute and check when the save fails", async () => {
    updatePreferencesMock.mockReset().mockResolvedValue({ status: "error" });
    render(<SettingsAppearance fontScale="default" />);
    fireEvent.click(screen.getByRole("button", { name: "X-Large 20px" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save — try again.");
    expect(document.documentElement.dataset.fontScale).toBe("default");
    expect(screen.getByRole("button", { name: "Default 16px" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("region", { name: "Preview" })).toHaveAttribute(
      "data-font-scale",
      "default",
    );
  });
});

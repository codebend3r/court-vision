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
  it("renders four radios labelled Small/Default/Large/X-Large", () => {
    render(<SettingsAppearance fontScale="default" />);
    ["Small", "Default", "Large", "X-Large"].forEach((label) => {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    });
  });

  it("checks the radio matching the fontScale prop", () => {
    render(<SettingsAppearance fontScale="lg" />);
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
  });

  it("carries data-font-scale on the preview region matching the checked radio", () => {
    render(<SettingsAppearance fontScale="lg" />);
    expect(screen.getByRole("region", { name: "Preview" })).toHaveAttribute(
      "data-font-scale",
      "lg",
    );
  });

  it("sets the document font scale and saves when X-Large is clicked", async () => {
    render(<SettingsAppearance fontScale="default" />);
    fireEvent.click(screen.getByRole("radio", { name: "X-Large" }));
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
    fireEvent.click(screen.getByRole("radio", { name: "X-Large" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save — try again.");
    expect(document.documentElement.dataset.fontScale).toBe("default");
    expect(screen.getByRole("radio", { name: "Default" })).toBeChecked();
    expect(screen.getByRole("region", { name: "Preview" })).toHaveAttribute(
      "data-font-scale",
      "default",
    );
  });
});

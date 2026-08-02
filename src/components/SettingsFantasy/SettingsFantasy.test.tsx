import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

import { SettingsFantasy } from "@/components/SettingsFantasy/SettingsFantasy";
import { ENABLED_METHODS } from "@/lib/valuation/registry";

const updatePreferencesMock = vi.fn();

vi.mock("@/lib/settings/actions", () => ({
  updatePreferences: (args: { preferredFormula?: string | null; fontScale?: string }) =>
    updatePreferencesMock(args),
}));

beforeEach(() => {
  updatePreferencesMock.mockReset().mockResolvedValue({ status: "ok" });
});

afterEach(cleanup);

describe("SettingsFantasy", () => {
  it("renders one radio per ENABLED_METHODS entry plus an App default radio", () => {
    render(<SettingsFantasy preferredFormula={null} />);
    expect(screen.getByRole("radio", { name: "App default" })).toBeInTheDocument();
    ENABLED_METHODS.forEach((method) => {
      expect(screen.getByRole("radio", { name: method.fullName })).toBeInTheDocument();
    });
  });

  it("starts with the preferred formula prop checked", () => {
    render(<SettingsFantasy preferredFormula="gscore" />);
    expect(screen.getByRole("radio", { name: "G-Score Valuation" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "App default" })).not.toBeChecked();
  });

  it("defaults to App default checked when the prop is null", () => {
    render(<SettingsFantasy preferredFormula={null} />);
    expect(screen.getByRole("radio", { name: "App default" })).toBeChecked();
  });

  it("calls updatePreferences with the method key when another radio is clicked", async () => {
    render(<SettingsFantasy preferredFormula="zscore" />);
    fireEvent.click(screen.getByRole("radio", { name: "G-Score Valuation" }));
    expect(updatePreferencesMock).toHaveBeenCalledWith({ preferredFormula: "gscore" });
    expect(screen.getByRole("radio", { name: "G-Score Valuation" })).toBeChecked();
    await waitFor(() => expect(updatePreferencesMock).toHaveBeenCalledTimes(1));
  });

  it("calls updatePreferences with null when App default is clicked", async () => {
    render(<SettingsFantasy preferredFormula="zscore" />);
    fireEvent.click(screen.getByRole("radio", { name: "App default" }));
    expect(updatePreferencesMock).toHaveBeenCalledWith({ preferredFormula: null });
    expect(screen.getByRole("radio", { name: "App default" })).toBeChecked();
    await waitFor(() => expect(updatePreferencesMock).toHaveBeenCalledTimes(1));
  });

  it("reverts the selection and shows an alert when the save fails", async () => {
    updatePreferencesMock.mockReset().mockResolvedValue({ status: "error" });
    render(<SettingsFantasy preferredFormula="zscore" />);
    fireEvent.click(screen.getByRole("radio", { name: "G-Score Valuation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save — try again.");
    expect(screen.getByRole("radio", { name: "Z-Score Valuation" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "G-Score Valuation" })).not.toBeChecked();
  });
});

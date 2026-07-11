import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Switch } from "@/components/Switch/Switch";

afterEach(cleanup);

describe("Switch", () => {
  it("renders a switch with its label", () => {
    render(<Switch label="Live updates" />);

    expect(screen.getByRole("switch", { name: "Live updates" })).not.toBeChecked();
  });

  it("toggles on click when uncontrolled and reports the new state", () => {
    const onChange = vi.fn();
    render(<Switch label="Live updates" onChange={onChange} />);

    const control = screen.getByRole("switch", { name: "Live updates" });
    fireEvent.click(control);

    expect(control).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ checked: true });
  });

  it("starts on when defaultChecked is set", () => {
    render(<Switch label="Live updates" defaultChecked />);

    expect(screen.getByRole("switch", { name: "Live updates" })).toBeChecked();
  });

  it("keeps a controlled value until the parent rerenders", () => {
    const onChange = vi.fn();
    render(<Switch label="Live updates" checked={false} onChange={onChange} />);

    const control = screen.getByRole("switch", { name: "Live updates" });
    fireEvent.click(control);

    expect(onChange).toHaveBeenCalledWith({ checked: true });
    expect(control).not.toBeChecked();
  });

  it("does not toggle or fire onChange when disabled", async () => {
    const onChange = vi.fn();
    render(<Switch label="Live updates" disabled onChange={onChange} />);

    const control = screen.getByRole("switch", { name: "Live updates" });
    const user = userEvent.setup();
    await user.click(control);

    expect(control).toBeDisabled();
    expect(control).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});

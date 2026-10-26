import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { useState } from "react";

import { ConfirmDialog } from "#ui/components/ConfirmDialog/ConfirmDialog";

type HarnessProps = { onConfirm?: () => void };

const Harness = ({ onConfirm = () => {} }: HarnessProps) => {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" onClick={() => setOpen(true)}>
        Remove player
      </button>
      {open && (
        <ConfirmDialog
          title="Remove Jalen Brunson?"
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        >
          They come off the point guard slot.
        </ConfirmDialog>
      )}
    </section>
  );
};

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("names the dialog by its title and describes it by its body", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    const dialog = screen.getByRole("dialog", { name: "Remove Jalen Brunson?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("They come off the point guard slot.");
  });

  it("moves focus onto Cancel when it opens", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Remove player" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("cancels from the Cancel button without confirming", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on a click on the backdrop but not inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    const dialog = screen.getByRole("dialog");
    await user.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms from the confirm button", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Remove player" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

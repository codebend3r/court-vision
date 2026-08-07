import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";
import { useRef, useState } from "react";

import { useFocusTrap } from "@/lib/a11y/focusTrap";

const Harness = ({ onEscape = () => {} }: { onEscape?: () => void }) => {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: () => {
      setOpen(false);
      onEscape();
    },
  });

  return (
    <section>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <section ref={dialogRef} role="dialog" aria-label="Confirm">
          <button type="button">First</button>
          <button type="button">Last</button>
        </section>
      )}
    </section>
  );
};

afterEach(cleanup);

describe("useFocusTrap", () => {
  it("moves focus to the first control when the dialog opens", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps Tab from the last control back to the first", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.tab();
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control to the last", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to whatever opened it", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);

    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

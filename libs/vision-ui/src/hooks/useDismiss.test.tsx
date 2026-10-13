import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { useDismiss } from "#ui/hooks/useDismiss";

afterEach(cleanup);

function Popover({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss({ open, ref, onDismiss });
  return (
    <>
      <div ref={ref}>
        <button type="button">Inside</button>
      </div>
      <button type="button">Outside</button>
    </>
  );
}

describe("useDismiss", () => {
  it("dismisses on a pointer down outside the container", async () => {
    const onDismiss = vi.fn();
    render(<Popover open onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Outside" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("ignores a pointer down inside the container", async () => {
    const onDismiss = vi.fn();
    render(<Popover open onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Inside" }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not listen while closed", async () => {
    const onDismiss = vi.fn();
    render(<Popover open={false} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Outside" }));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});

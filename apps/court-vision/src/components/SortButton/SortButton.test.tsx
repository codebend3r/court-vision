import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { SortButton } from "@/components/SortButton/SortButton";

afterEach(cleanup);

describe("SortButton", () => {
  it("shows the direction arrow only on the active column", () => {
    const { rerender } = render(
      <SortButton label="Z-Score" isActive={false} dir="desc" onClick={vi.fn()} />,
    );
    const button = screen.getByRole("button", { name: "Z-Score" });
    expect(button).toHaveAttribute("data-active", "false");
    expect(button).toHaveTextContent(/^Z-Score$/);

    rerender(<SortButton label="Z-Score" isActive dir="desc" onClick={vi.fn()} />);
    expect(button).toHaveAttribute("data-active", "true");
    expect(button).toHaveTextContent("Z-Score▼");

    rerender(<SortButton label="Z-Score" isActive dir="asc" onClick={vi.fn()} />);
    expect(button).toHaveTextContent("Z-Score▲");
  });

  it("keeps the arrow out of the accessible name", () => {
    render(<SortButton label="G-Score" isActive dir="asc" onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "G-Score" })).toBeInTheDocument();
  });

  it("sorts on click and forwards the container's class and attributes", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SortButton
        label="PL Linear"
        isActive={false}
        dir="desc"
        onClick={onClick}
        className="statSort"
        aria-describedby="tip"
      />,
    );
    const button = screen.getByRole("button", { name: "PL Linear" });

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveClass("sortButton", "statSort");
    expect(button).toHaveAttribute("aria-describedby", "tip");
    expect(button).toHaveAttribute("type", "button");
  });
});

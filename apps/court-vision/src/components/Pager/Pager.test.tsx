import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { Pager, type PagerProps } from "@/components/Pager/Pager";
import { PAGE_SIZES } from "@/lib/players/searchParams";

afterEach(cleanup);

const renderPager = (props: Partial<PagerProps> = {}) => {
  const onPageChange = vi.fn();
  const onSizeChange = vi.fn();
  render(
    <Pager
      page={2}
      totalPages={5}
      size={50}
      onPageChange={onPageChange}
      onSizeChange={onSizeChange}
      {...props}
    />,
  );
  return { onPageChange, onSizeChange };
};

describe("Pager", () => {
  it("shows the current position", () => {
    renderPager();
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  it("drops the total while it is unknown", () => {
    renderPager({ isTotalKnown: false });
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.queryByText(/of 5/)).not.toBeInTheDocument();
  });

  it("disables Prev on the first page and Next on the last", () => {
    renderPager({ page: 1, totalPages: 1 });
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("emits page changes", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPager();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith({ page: 3 });
    await user.click(screen.getByRole("button", { name: "Prev" }));
    expect(onPageChange).toHaveBeenCalledWith({ page: 1 });
  });

  it("lists every page size and emits size changes", async () => {
    const user = userEvent.setup();
    const { onSizeChange } = renderPager();
    const select = screen.getByLabelText(/Page size/);
    PAGE_SIZES.forEach((size) => {
      expect(screen.getByRole("option", { name: String(size) })).toBeInTheDocument();
    });
    await user.selectOptions(select, "25");
    expect(onSizeChange).toHaveBeenCalledWith({ size: 25 });
  });

  it("marks the bar pending and busy while a page loads", () => {
    renderPager({ isPending: true });
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toHaveAttribute("data-pending", "true");
    expect(nav).toHaveAttribute("aria-busy", "true");
  });
});

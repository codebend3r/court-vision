import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FantasyPager } from "@/components/FantasyPager/FantasyPager";
import { PAGE_SIZES } from "@/lib/players/searchParams";

afterEach(cleanup);

const renderPager = ({ page = 2, totalPages = 5 }: { page?: number; totalPages?: number } = {}) => {
  const onPageChange = vi.fn();
  const onSizeChange = vi.fn();
  render(
    <FantasyPager
      page={page}
      totalPages={totalPages}
      size={50}
      onPageChange={onPageChange}
      onSizeChange={onSizeChange}
    />,
  );
  return { onPageChange, onSizeChange };
};

describe("FantasyPager", () => {
  it("shows the current position", () => {
    renderPager();
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last", () => {
    renderPager({ page: 1, totalPages: 1 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("emits page changes", async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderPager();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith({ page: 3 });
    await user.click(screen.getByRole("button", { name: "Previous" }));
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
});

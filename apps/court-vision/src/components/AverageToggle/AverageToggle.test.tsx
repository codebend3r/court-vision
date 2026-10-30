import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "bun:test";

import { AverageToggle } from "@/components/AverageToggle/AverageToggle";

afterEach(cleanup);

describe("AverageToggle", () => {
  it("is a labelled checkbox, ticked by default, that writes ?avg=false when cleared", async () => {
    const onUrlUpdate = vi.fn();
    render(<AverageToggle />, { wrapper: withNuqsTestingAdapter({ onUrlUpdate }) });

    const box = screen.getByRole("checkbox", { name: "League average" });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    await waitFor(() =>
      expect(onUrlUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ queryString: "?avg=false" }),
      ),
    );
  });

  it("reads the setting from the URL", () => {
    render(<AverageToggle />, {
      wrapper: withNuqsTestingAdapter({ searchParams: "?avg=false" }),
    });

    expect(screen.getByRole("checkbox", { name: "League average" })).not.toBeChecked();
  });
});

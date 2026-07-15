import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";

afterEach(cleanup);

const SEASONS = ["2025-26", "2024-25", "2023-24"];

const renderSelect = ({
  value = "2025-26",
  searchParams = "",
}: { value?: string; searchParams?: string } = {}) => {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(<SeasonSelect seasons={SEASONS} value={value} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }),
  });
  return { onUrlUpdate };
};

describe("SeasonSelect", () => {
  it("lists every season plus a Career option", () => {
    renderSelect();

    SEASONS.map((season) =>
      expect(screen.getByRole("option", { name: season })).toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "Career" })).toBeInTheDocument();
  });

  it("shows the resolved scope as the selected value", () => {
    renderSelect({ value: "2024-25" });

    expect(screen.getByRole("combobox")).toHaveValue("2024-25");
  });

  it("writes the chosen season to the URL", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderSelect();

    await user.selectOptions(screen.getByRole("combobox"), "2023-24");

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("season")).toBe("2023-24");
  });

  it("writes the career sentinel when Career is chosen", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderSelect();

    await user.selectOptions(screen.getByRole("combobox"), "Career");

    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("season")).toBe("career");
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeasonSelect } from "@/components/SeasonSelect/SeasonSelect";

afterEach(cleanup);

const renderSelect = ({
  seasons = ["2025-26", "2023-24"],
  value = "2025-26",
  searchParams = "",
}: {
  seasons?: string[];
  value?: string;
  searchParams?: string;
} = {}) => {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  render(<SeasonSelect seasons={seasons} value={value} />, {
    wrapper: withNuqsTestingAdapter({ searchParams, onUrlUpdate }),
  });
  return { onUrlUpdate };
};

describe("SeasonSelect", () => {
  it("lists the player's seasons in the given order plus Career", () => {
    renderSelect();

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["2025-26", "2023-24", "Career"]);
  });

  it("selects the server-resolved value even when the URL has no param", () => {
    renderSelect({ value: "2023-24" });

    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2023-24");
  });

  it("injects an unplayed requested season so the select reflects the URL", () => {
    renderSelect({ value: "2021-22" });

    expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2021-22");
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "2021-22",
      "2025-26",
      "2023-24",
      "Career",
    ]);
  });

  it("writes the picked season to the URL", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderSelect();

    await user.selectOptions(screen.getByRole("combobox", { name: "Season" }), "2023-24");

    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate.mock.calls[0][0].searchParams.get("season")).toBe("2023-24");
  });

  it("writes the career sentinel and keeps other filters", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderSelect({ searchParams: "?mode=totals" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Season" }), "Career");

    const updated = onUrlUpdate.mock.calls[0][0].searchParams;
    expect(updated.get("season")).toBe("career");
    expect(updated.get("mode")).toBe("totals");
  });
});

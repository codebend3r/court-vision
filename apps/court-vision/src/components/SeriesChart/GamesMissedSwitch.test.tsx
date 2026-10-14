import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { withNuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it } from "bun:test";

import { GamesMissedSwitch, useShowDnp } from "@/components/SeriesChart/GamesMissedSwitch";

afterEach(cleanup);

function DnpReadout() {
  const { showDnp } = useShowDnp();
  return <output aria-label="dnp">{String(showDnp)}</output>;
}

const renderSwitch = ({
  searchParams = {},
  onUrlUpdate,
}: {
  searchParams?: Record<string, string>;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
} = {}) =>
  render(
    <>
      <GamesMissedSwitch />
      <DnpReadout />
    </>,
    { wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams, onUrlUpdate }) },
  );

describe("GamesMissedSwitch", () => {
  it("starts off without a dnp param", () => {
    renderSwitch();
    expect(screen.getByRole("switch", { name: "Games missed" })).not.toBeChecked();
    expect(screen.getByRole("status", { name: "dnp" })).toHaveTextContent("false");
  });

  it("restores the on state from the URL", () => {
    renderSwitch({ searchParams: { dnp: "true" } });
    expect(screen.getByRole("switch", { name: "Games missed" })).toBeChecked();
  });

  it("writes the toggle to the URL and every reader of it", async () => {
    const user = userEvent.setup();
    const updates: UrlUpdateEvent[] = [];
    renderSwitch({ onUrlUpdate: (event) => updates.push(event) });

    await user.click(screen.getByRole("switch", { name: "Games missed" }));

    expect(updates.at(-1)?.queryString).toBe("?dnp=true");
    expect(screen.getByRole("status", { name: "dnp" })).toHaveTextContent("true");
  });
});

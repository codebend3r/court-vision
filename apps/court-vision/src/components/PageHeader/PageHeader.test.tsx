import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { PageAction, PageHeader } from "@/components/PageHeader/PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the eyebrow, title, and description", () => {
    render(
      <PageHeader eyebrow="Research" title="Players" description="Every player, every metric." />,
    );
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeInTheDocument();
    expect(screen.getByText("Every player, every metric.")).toBeInTheDocument();
  });

  it("omits the description paragraph when not provided", () => {
    render(<PageHeader eyebrow="Account" title="Settings" />);
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader
        eyebrow="Dashboard"
        title="Command centre"
        actions={<PageAction href="/players">Open players</PageAction>}
      />,
    );
    expect(screen.getByRole("link", { name: "Open players" })).toHaveAttribute("href", "/players");
  });
});

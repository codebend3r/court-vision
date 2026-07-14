import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ComingSoonPanel } from "@/components/ComingSoonPanel/ComingSoonPanel";

afterEach(cleanup);

describe("ComingSoonPanel", () => {
  it("renders the title, description, and a coming soon badge", () => {
    render(<ComingSoonPanel title="Fantasy Value" description="A blended score is on the way." />);

    expect(screen.getByRole("heading", { name: "Fantasy Value" })).toBeInTheDocument();
    expect(screen.getByText("A blended score is on the way.")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});

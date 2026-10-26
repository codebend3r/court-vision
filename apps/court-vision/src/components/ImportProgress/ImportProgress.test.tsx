import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { ImportProgress } from "@/components/ImportProgress/ImportProgress";

afterEach(cleanup);

describe("ImportProgress", () => {
  it("announces the title as a status", () => {
    render(<ImportProgress title="Importing your league" />);
    expect(screen.getByRole("status")).toHaveTextContent("Importing your league");
  });

  it("starts on the first step and keeps the steps out of the accessibility tree", () => {
    render(<ImportProgress title="Importing" steps={["First", "Second"]} />);
    expect(screen.getByText("First")).toHaveAttribute("aria-hidden", "true");
  });

  it("walks the steps and rests on the last", async () => {
    render(<ImportProgress title="Importing" steps={["First", "Second"]} intervalMs={10} />);
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import Loading from "@/app/players/loading";

afterEach(cleanup);

describe("players loading boundary", () => {
  it("keeps the real page heading while the table loads", () => {
    render(<Loading />);
    expect(screen.getByRole("heading", { level: 1, name: "Players" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading players");
  });
});

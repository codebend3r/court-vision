import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import Loading from "@/app/loading";

afterEach(cleanup);

describe("root loading boundary", () => {
  it("renders a main landmark with a polite loading status", () => {
    render(<Loading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
  });
});

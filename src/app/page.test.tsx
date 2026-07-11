import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("renders an empty main", () => {
    render(<Home />);
    const main = screen.getByRole("main");
    expect(main).toBeEmptyDOMElement();
  });
});

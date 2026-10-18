import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import PrivacyPage from "@/app/privacy/page";

afterEach(cleanup);

const SECTIONS = [
  "What the extension reads",
  "What it sends to Court Vision",
  "What it never reads or sends",
  "Selling and sharing",
  "Deleting your data",
  "Not affiliated with Yahoo",
  "Contact",
];

describe("PrivacyPage", () => {
  it("opens with a single Privacy h1", () => {
    render(<PrivacyPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
  });

  it("has an h2 for each policy section, in order", () => {
    render(<PrivacyPage />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(SECTIONS);
  });

  it("links the contact email", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "cj.rivas.dev@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:cj.rivas.dev@gmail.com",
    );
  });

  it("states that Court Vision is not affiliated with Yahoo", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/Court Vision is not affiliated with Yahoo/)).toBeInTheDocument();
  });

  it("says the extension never reads the Yahoo password or cookies", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(/never reads or sends your Yahoo password or cookies/),
    ).toBeInTheDocument();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";

import { AuthCard } from "@/app/(auth)/AuthCard";

afterEach(cleanup);

describe("AuthCard", () => {
  it("names its card after the page's one h1 and renders the form below", () => {
    render(
      <AuthCard titleId="login-title" title="Sign in">
        <form aria-label="Sign-in form" />
      </AuthCard>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-centered");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign-in form" })).toBeInTheDocument();
  });
});

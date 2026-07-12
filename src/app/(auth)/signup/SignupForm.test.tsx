import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signUpAction = vi.fn();

vi.mock("@/lib/auth/signup", () => ({ signUp: (...a: unknown[]) => signUpAction(...a) }));

import { SignupForm } from "./SignupForm";

afterEach(cleanup);

describe("SignupForm", () => {
  beforeEach(() => signUpAction.mockReset());

  it("shows the check-email state on success", async () => {
    signUpAction.mockResolvedValue({ ok: true });
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/username/i), "steve");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("shows an error when the username is taken", async () => {
    signUpAction.mockResolvedValue({ ok: false, error: "That username is taken." });
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/username/i), "steve");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/that username is taken/i)).toBeInTheDocument();
  });
});

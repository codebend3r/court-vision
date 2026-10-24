import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const requestPasswordReset = vi.fn();

vi.mock("@/lib/auth/passwordReset", () => ({
  requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
}));

import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/ForgotPasswordForm";

afterEach(cleanup);

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
  });

  it("shows the check-email state and moves focus to it on success", async () => {
    requestPasswordReset.mockResolvedValue({ ok: true });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "a@b.com" });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("shows the error and keeps the form when the request fails", async () => {
    requestPasswordReset.mockResolvedValue({ ok: false, error: "Wait 47 seconds" });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/wait 47 seconds/i);
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeEnabled();
  });

  it("renders the notice explaining a dead reset link", () => {
    render(<ForgotPasswordForm notice="That reset link didn't work." />);
    expect(screen.getByText(/that reset link didn't work/i)).toBeInTheDocument();
  });

  it("links back to sign in", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});

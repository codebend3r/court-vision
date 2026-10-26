import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const updateUser = vi.fn();
const push = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { ResetPasswordForm } from "@/app/(auth)/reset-password/ResetPasswordForm";

afterEach(cleanup);

type FillProps = { password: string; confirm: string };

async function fill({ password, confirm }: FillProps): Promise<void> {
  await userEvent.type(screen.getByLabelText(/^new password/i), password);
  await userEvent.type(screen.getByLabelText(/confirm new password/i), confirm);
  await userEvent.click(screen.getByRole("button", { name: /update password/i }));
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    updateUser.mockReset();
    push.mockReset();
  });

  it("updates the password and goes home", async () => {
    updateUser.mockResolvedValue({ error: null });
    render(<ResetPasswordForm />);
    await fill({ password: "password123", confirm: "password123" });
    expect(updateUser).toHaveBeenCalledWith({ password: "password123" });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("rejects a password that is too short without calling Supabase", async () => {
    render(<ResetPasswordForm />);
    await fill({ password: "short", confirm: "short" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling Supabase", async () => {
    render(<ResetPasswordForm />);
    await fill({ password: "password123", confirm: "password124" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows a Supabase failure and re-enables the form", async () => {
    updateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password." },
    });
    render(<ResetPasswordForm />);
    await fill({ password: "password123", confirm: "password123" });
    expect(await screen.findByRole("alert")).toHaveTextContent(/different from the old/i);
    expect(screen.getByRole("button", { name: /update password/i })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});

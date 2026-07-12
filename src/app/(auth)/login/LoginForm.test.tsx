import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const push = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { LoginForm } from "./LoginForm";

afterEach(cleanup);

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    push.mockReset();
  });

  it("shows an error on bad credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(push).toHaveBeenCalledWith("/");
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const signInWithPassword = vi.fn();
const push = vi.fn();
const resendConfirmation = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/auth/signup", () => ({ resendConfirmation }));

import { LoginForm } from "@/app/(auth)/login/LoginForm";

const REDIRECTING_MESSAGE = "Signed in. Loading your dashboard…";

afterEach(cleanup);

async function submitCredentials(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
  await userEvent.type(screen.getByLabelText(/password/i), "password123");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    push.mockReset();
    resendConfirmation.mockReset();
  });

  it("shows an error on bad credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm next="/" />);
    await submitCredentials();
    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    await submitCredentials();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("keeps its status regions mounted and empty before there is anything to say", () => {
    render(<LoginForm next="/" />);
    const regions = screen.getAllByRole("status");
    expect(regions).toHaveLength(2);
    regions.forEach((region) => expect(region).toBeEmptyDOMElement());
  });

  // Captures the node before submitting and asserts against that same node
  // afterwards: a region that is inserted along with its text is not reliably
  // announced, so proving it was already there is the point of the test.
  it("announces the handoff in a region that was already in the DOM", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    const [handoffRegion] = screen.getAllByRole("status");
    expect(handoffRegion).toBeEmptyDOMElement();
    await submitCredentials();
    await waitFor(() => expect(handoffRegion).toHaveTextContent(/loading your dashboard/i));
    expect(screen.getByRole("button", { name: /signed in/i })).toBeDisabled();
  });

  it("shows the handoff message to sighted users without repeating it to screen readers", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/" />);
    await submitCredentials();
    const visible = await screen.findByText(REDIRECTING_MESSAGE, { ignore: "[role=status]" });
    expect(visible).toHaveAttribute("aria-hidden", "true");
  });

  it("re-enables the form after a failed sign in", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm next="/" />);
    await submitCredentials();
    await screen.findByText(/invalid login credentials/i);
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  });

  it("renders the notice explaining a failed confirmation link", () => {
    render(<LoginForm next="/" notice="That confirmation link didn't work." />);
    expect(screen.getByText(/that confirmation link didn't work/i)).toBeInTheDocument();
  });

  it("does not offer a resend when there is no notice or error", () => {
    render(<LoginForm next="/" />);
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("does not offer a resend for ordinary bad credentials", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    render(<LoginForm next="/" />);
    await submitCredentials();
    await screen.findByText(/invalid login credentials/i);
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("offers a resend when the account was never confirmed", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    render(<LoginForm next="/" />);
    await submitCredentials();
    expect(
      await screen.findByRole("button", { name: /resend confirmation email/i }),
    ).toBeInTheDocument();
  });

  it("resends to the typed address and confirms it went out", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    resendConfirmation.mockResolvedValue({ ok: true });
    render(<LoginForm next="/" />);
    await submitCredentials();
    await userEvent.click(
      await screen.findByRole("button", { name: /resend confirmation email/i }),
    );

    expect(resendConfirmation).toHaveBeenCalledWith({ email: "a@b.com" });
    // Two status regions in document order: the sign-in handoff, then this one.
    const [, resendRegion] = screen.getAllByRole("status");
    await waitFor(() => expect(resendRegion).toHaveTextContent(/a@b\.com/));
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("keeps the resend available when it fails", async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    resendConfirmation.mockResolvedValue({ ok: false, error: "Wait 47 seconds" });
    render(<LoginForm next="/" />);
    await submitCredentials();
    await userEvent.click(
      await screen.findByRole("button", { name: /resend confirmation email/i }),
    );

    expect(await screen.findByText(/wait 47 seconds/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend confirmation email/i })).toBeInTheDocument();
  });
});

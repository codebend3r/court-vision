"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isUnconfirmedEmailError } from "@/lib/auth/loginNotice";
import { resendConfirmation } from "@/lib/auth/signup";
import { createClient } from "@/lib/supabase/client";

import styles from "./login.module.scss";

// "offered" only appears once sign-in has told us the account is unconfirmed, so
// the resend button never shows up unprompted.
type ResendState = "idle" | "offered" | "sending" | "sent";

export function LoginForm({ next, notice }: { next: string; notice?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resend, setResend] = useState<ResendState>("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResend("idle");
    setPending(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signInError) {
      setError(signInError.message);
      // Accounts created before the confirmation link was fixed were mailed a
      // localhost URL, so they can never get past this error on their own.
      if (isUnconfirmedEmailError(signInError)) {
        setResend("offered");
      }
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onResend() {
    setResend("sending");
    const result = await resendConfirmation({ email });
    if (!result.ok) {
      setError(result.error);
      setResend("offered");
      return;
    }
    setError(null);
    setResend("sent");
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {/* Rendered on load and read in document order, so it needs no live region. */}
      {!!notice && <p className={styles.notice}>{notice}</p>}
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!!error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {(resend === "offered" || resend === "sending") && (
        <button
          type="button"
          className={styles.resend}
          onClick={onResend}
          disabled={resend === "sending"}
        >
          {resend === "sending" ? "Sending…" : "Resend confirmation email"}
        </button>
      )}
      {resend === "sent" && (
        <p className={styles.sent} role="status">
          Confirmation sent to {email}. Click the link in it to finish setting up your account.
        </p>
      )}
      <p className={styles.alt}>
        No account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}

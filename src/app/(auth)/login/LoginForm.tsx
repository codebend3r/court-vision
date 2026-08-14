"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { isUnconfirmedEmailError } from "@/lib/auth/loginNotice";
import { resendConfirmation } from "@/lib/auth/signup";
import { createClient } from "@/lib/supabase/client";

import styles from "./login.module.scss";

// "offered" only appears once sign-in has told us the account is unconfirmed, so
// the resend button never shows up unprompted.
type ResendState = "idle" | "offered" | "sending" | "sent";

// "redirecting" persists until the navigation unmounts the form, so the user
// sees a live status through the (dynamic, database-bound) first page load
// instead of a button that silently stops saying "Signing in".
type SubmitPhase = "idle" | "submitting" | "redirecting";

export function LoginForm({ next, notice }: { next: string; notice?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [resend, setResend] = useState<ResendState>("idle");
  const errorId = useId();
  const pending = phase !== "idle";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResend("idle");
    setPhase("submitting");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setPhase("idle");
      setError(signInError.message);
      // Accounts created before the confirmation link was fixed were mailed a
      // localhost URL, so they can never get past this error on their own.
      if (isUnconfirmedEmailError(signInError)) {
        setResend("offered");
      }
      return;
    }
    setPhase("redirecting");
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
          autoComplete="email"
          aria-invalid={!!error}
          aria-describedby={error === null ? undefined : errorId}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!error}
          aria-describedby={error === null ? undefined : errorId}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {/* role="alert" so a failed sign-in is spoken; the id ties it to both
          fields so it is also read when focus returns to them. */}
      {!!error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {phase === "idle" ? "Sign in" : phase === "submitting" ? "Signing in…" : "Signed in"}
      </button>
      {/* role="status" announces the handoff politely; the message stays up
          until the destination route (and its loading skeleton) takes over. */}
      {phase === "redirecting" && (
        <p className={styles.redirecting} role="status">
          Signed in. Loading your dashboard…
        </p>
      )}
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

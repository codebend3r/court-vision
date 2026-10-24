"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { requestPasswordReset } from "@/lib/auth/passwordReset";

import authStyles from "@/app/(auth)/auth.module.scss";
import styles from "@/app/(auth)/forgot-password/forgot-password.module.scss";

export function ForgotPasswordForm({ notice }: { notice?: string | null }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const errorId = useId();
  const sentRef = useRef<HTMLDivElement>(null);

  // Submitting swaps the form out for the confirmation panel, which would
  // otherwise drop focus to <body> with nothing announced.
  useEffect(() => {
    if (!sent) return;
    sentRef.current?.focus();
  }, [sent]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await requestPasswordReset({ email });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.sent} ref={sentRef} tabIndex={-1} role="status">
        <h2>Check your email</h2>
        <p>
          If an account exists for {email}, we sent a link to reset your password. It may take a
          minute to arrive.
        </p>
        <p className={authStyles.alt}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form className={authStyles.form} onSubmit={onSubmit}>
      {/* Rendered on load and read in document order, so it needs no live region. */}
      {!!notice && <p className={styles.notice}>{notice}</p>}
      <label className={authStyles.field}>
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
      {!!error && (
        <p className={authStyles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className={authStyles.alt}>
        Remembered it? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}

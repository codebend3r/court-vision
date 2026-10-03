"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { signUp } from "@/lib/auth/signup";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

import styles from "@/app/(auth)/signup/signup.module.scss";

type Availability = "idle" | "checking" | "available" | "taken";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const errorId = useId();
  const usernameStatusId = useId();
  const sentRef = useRef<HTMLDivElement>(null);

  const normalized = normalizeUsername(username);
  const usernameValid = isValidUsername(normalized);
  const usernameTaken = usernameValid && availability === "taken";

  // Submitting swaps the form out for the confirmation panel, which would
  // otherwise drop focus to <body> with nothing announced.
  useEffect(() => {
    if (!sent) return;
    sentRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (!usernameValid) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAvailability("checking");
      try {
        const response = await fetch(
          `/api/username-available?u=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setAvailability(data?.available === true ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [normalized, usernameValid]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The submit button is aria-disabled rather than disabled, so it stays
    // clickable; the rule it advertises is enforced here.
    if (pending || usernameTaken) return;
    setError(null);
    setPending(true);
    const result = await signUp({ email, username, password });
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
        <p>We sent a confirmation link to {email}. Click it to finish creating your account.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
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
        <span>Username</span>
        <input
          type="text"
          required
          autoComplete="username"
          aria-invalid={usernameTaken}
          aria-describedby={usernameStatusId}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      {/* One region that stays mounted rather than two that come and go: a
          node added at the same moment its text appears is unreliable to
          announce, and this is also what explains the disabled submit. */}
      <p
        className={usernameTaken ? styles.taken : styles.available}
        id={usernameStatusId}
        role="status"
      >
        {!!usernameTaken && "That username is taken."}
        {usernameValid && availability === "available" && "Username is available."}
      </p>
      <p className={styles.hint}>3–20 characters: lowercase letters, numbers, underscores.</p>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={!!error}
          aria-describedby={error === null ? undefined : errorId}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!!error && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      {/* aria-disabled, not disabled: a disabled button is removed from the tab
          order, so a keyboard user can never land on it to hear why it is
          blocked. onSubmit enforces the same rule. */}
      <button
        type="submit"
        aria-disabled={pending || usernameTaken}
        aria-describedby={usernameStatusId}
      >
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className={styles.alt}>
        Have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}

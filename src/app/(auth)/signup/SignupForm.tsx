"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { signUp } from "@/lib/auth/signup";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

import styles from "./signup.module.scss";

type Availability = "idle" | "checking" | "available" | "taken";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const normalized = normalizeUsername(username);
  const usernameValid = isValidUsername(normalized);

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
      <div className={styles.sent}>
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Username</span>
        <input
          type="text"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      {usernameValid && availability === "taken" && (
        <p className={styles.taken}>That username is taken.</p>
      )}
      {usernameValid && availability === "available" && (
        <p className={styles.available}>Username is available.</p>
      )}
      <p className={styles.hint}>3–20 characters: lowercase letters, numbers, underscores.</p>
      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {!!error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={pending || (usernameValid && availability === "taken")}>
        {pending ? "Creating…" : "Create account"}
      </button>
      <p className={styles.alt}>
        Have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}

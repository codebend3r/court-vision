"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

import authStyles from "@/app/(auth)/auth.module.scss";

const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(updateError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form className={authStyles.form} onSubmit={onSubmit}>
      <label className={authStyles.field}>
        <span>New password</span>
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
      <label className={authStyles.field}>
        <span>Confirm new password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={!!error}
          aria-describedby={error === null ? undefined : errorId}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </label>
      {!!error && (
        <p className={authStyles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

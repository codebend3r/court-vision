import { redirect } from "next/navigation";

import { RESET_FAILED_MESSAGE } from "@/lib/auth/loginNotice";
import { getUser } from "@/lib/auth/session";

import { AuthCard } from "@/app/(auth)/AuthCard";
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/ForgotPasswordForm";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const [user, { error }] = await Promise.all([getUser(), searchParams]);
  if (user) {
    redirect("/");
  }
  // /auth/confirm redirects here with ?error=reset when a reset link fails.
  const notice = error === "reset" ? RESET_FAILED_MESSAGE : null;
  return (
    <AuthCard titleId="forgot-title" title="Reset your password">
      <ForgotPasswordForm notice={notice} />
    </AuthCard>
  );
}

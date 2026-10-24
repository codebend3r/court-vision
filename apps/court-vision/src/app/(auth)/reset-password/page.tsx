import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import { AuthCard } from "@/app/(auth)/AuthCard";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/ResetPasswordForm";

export default async function ResetPasswordPage() {
  // The recovery link signs the user in before landing here, so no session
  // means the link was never used (or the page was opened directly).
  const user = await getUser();
  if (!user) {
    redirect("/forgot-password?error=reset");
  }
  return (
    <AuthCard titleId="reset-title" title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}

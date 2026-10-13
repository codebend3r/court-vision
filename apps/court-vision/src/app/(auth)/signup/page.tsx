import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import { AuthCard } from "@/app/(auth)/AuthCard";
import { SignupForm } from "@/app/(auth)/signup/SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  return (
    <AuthCard titleId="signup-title" title="Create your account">
      <SignupForm />
    </AuthCard>
  );
}

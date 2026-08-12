import { redirect } from "next/navigation";

import { LogoLockup } from "@/components/Logo/Logo";
import { getUser } from "@/lib/auth/session";

import authStyles from "@/app/(auth)/auth.module.scss";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  return (
    <main className={authStyles.shell} data-centered>
      <section className={authStyles.card} aria-labelledby="signup-title">
        <LogoLockup orientation="vertical" />
        <h1 className={authStyles.title} id="signup-title">
          Create your account
        </h1>
        <SignupForm />
      </section>
    </main>
  );
}

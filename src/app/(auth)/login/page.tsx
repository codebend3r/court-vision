import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import authStyles from "@/app/(auth)/auth.module.scss";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  const { next } = await searchParams;
  return (
    <main className={authStyles.shell}>
      <h1 className={authStyles.title}>Sign in</h1>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}

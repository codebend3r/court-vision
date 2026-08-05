import { redirect } from "next/navigation";

import { isLoginNoticeCode, loginNoticeMessage } from "@/lib/auth/loginNotice";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { getUser } from "@/lib/auth/session";

import authStyles from "@/app/(auth)/auth.module.scss";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  const { next, error } = await searchParams;
  // /auth/confirm redirects here with ?error=confirm when a link fails; without
  // this the user got a bare form and no explanation.
  const notice = isLoginNoticeCode(error) ? loginNoticeMessage(error) : null;
  return (
    <main className={authStyles.shell} data-centered>
      <h1 className={authStyles.title}>Sign in</h1>
      <LoginForm next={safeNextPath(next)} notice={notice} />
    </main>
  );
}

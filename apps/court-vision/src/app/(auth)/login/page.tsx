import { redirect } from "next/navigation";

import { isLoginNoticeCode, loginNoticeMessage } from "@/lib/auth/loginNotice";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { getUser } from "@/lib/auth/session";

import { AuthCard } from "@/app/(auth)/AuthCard";
import { LoginForm } from "@/app/(auth)/login/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  const { next, error } = await searchParams;
  // /auth/confirm redirects here with ?error=confirm when a link fails; without
  // this the user got a bare form and no explanation.
  const notice = isLoginNoticeCode(error) ? loginNoticeMessage(error) : null;
  return (
    <AuthCard titleId="login-title" title="Sign in">
      <LoginForm next={safeNextPath({ next })} notice={notice} />
    </AuthCard>
  );
}

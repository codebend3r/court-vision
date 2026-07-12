import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/session";

import authStyles from "../auth.module.scss";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getUser();
  if (user) {
    redirect("/");
  }
  return (
    <main className={authStyles.shell}>
      <h1 className={authStyles.title}>Create your account</h1>
      <SignupForm />
    </main>
  );
}

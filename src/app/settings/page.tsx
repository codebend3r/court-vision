import { redirect } from "next/navigation";

import { SettingsAppearance } from "@/components/SettingsAppearance/SettingsAppearance";
import { SettingsFantasy } from "@/components/SettingsFantasy/SettingsFantasy";
import { SettingsTheme } from "@/components/SettingsTheme/SettingsTheme";
import { getProfile } from "@/lib/auth/session";
import { isFontScale, isPreferredFormula } from "@/lib/settings/guards";

import styles from "@/app/settings/page.module.scss";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (profile === null) redirect("/login?next=/settings");
  const preferredFormula =
    profile.preferredFormula !== null && isPreferredFormula(profile.preferredFormula)
      ? profile.preferredFormula
      : null;
  const fontScale = isFontScale(profile.fontScale) ? profile.fontScale : "default";
  return (
    <main className={styles.page}>
      <h1>Settings</h1>
      <SettingsFantasy preferredFormula={preferredFormula} />
      <SettingsAppearance fontScale={fontScale} />
      <SettingsTheme />
    </main>
  );
}

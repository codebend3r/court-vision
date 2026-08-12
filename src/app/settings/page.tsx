import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader/PageHeader";
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
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Theme, text size, and which valuation formula the app should trust by default."
      />
      <SettingsFantasy preferredFormula={preferredFormula} />
      <SettingsAppearance fontScale={fontScale} />
      <SettingsTheme />
    </main>
  );
}

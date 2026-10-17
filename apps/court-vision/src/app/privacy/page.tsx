import { PageHeader } from "@vision/ui/components/PageHeader/PageHeader";

import styles from "@/app/privacy/privacy.module.scss";

// Static and public on purpose: the Chrome Web Store listing links here, so the
// page must render signed out with no session read and no dynamic export.
export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Court Vision"
        title="Privacy"
        description="How the Court Vision extension and this site handle your data."
      />
      <div className={styles.prose}>
        <section className={styles.section}>
          <h2 className={styles.heading}>What the extension reads</h2>
          <p>
            The Court Vision extension reads Yahoo Fantasy data only for a league you ask Court
            Vision to import or sync. It does this with your Yahoo login in your own browser, so it
            can see the same leagues you can.
          </p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>What it sends to Court Vision</h2>
          <p>
            It sends that league&apos;s settings, teams and rosters to Court Vision. They are saved
            to your Court Vision account.
          </p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>What it never reads or sends</h2>
          <p>
            The extension never reads or sends your Yahoo password or cookies, or your browsing
            history.
          </p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>Selling and sharing</h2>
          <p>Nothing is sold or shared.</p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>Deleting your data</h2>
          <p>Deleting a league in Court Vision deletes the data that was imported for it.</p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>Not affiliated with Yahoo</h2>
          <p>Court Vision is not affiliated with Yahoo.</p>
        </section>
        <section className={styles.section}>
          <h2 className={styles.heading}>Contact</h2>
          {/* TODO(owner): replace this placeholder with real contact details before the Chrome Web Store listing goes live. */}
          <p>Questions about this policy can be sent to the Court Vision team.</p>
        </section>
      </div>
    </div>
  );
}

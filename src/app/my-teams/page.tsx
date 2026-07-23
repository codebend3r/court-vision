import Link from "next/link";

import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";

import styles from "@/app/my-teams/page.module.scss";

export default function MyTeamsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>My Teams</h1>
        <Link href="/my-teams/create" className={styles.create}>
          Create team
        </Link>
      </header>
      <MyTeamsList />
    </main>
  );
}

import Link from "next/link";
import styles from "@/app/my-teams/page.module.scss";
import { MyTeamsList } from "@/components/MyTeamsList/MyTeamsList";

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

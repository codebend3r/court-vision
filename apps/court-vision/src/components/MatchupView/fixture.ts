import { parseStatValue } from "@/lib/matchups/standings";
import { type LeagueWeek, type WeekTeam } from "@/lib/matchups/types";

type WeekProps = {
  teamId: string;
  isMine?: boolean;
  steals: string;
  turnovers: string;
};

const week = ({ teamId, isMine = false, steals, turnovers }: WeekProps): WeekTeam => ({
  teamId,
  name: `Team ${teamId}`,
  slug: teamId,
  logoUrl: null,
  managerName: isMine ? "Kim" : null,
  isMine,
  display: { "17": steals, "19": turnovers },
  values: { "17": parseStatValue({ raw: steals }), "19": parseStatValue({ raw: turnovers }) },
});

// Four teams in two matchups: a plays b, c plays d. Mine is a.
export const TEST_WEEK: LeagueWeek = {
  syncedAt: "2026-10-28T12:00:00.000Z",
  week: 2,
  weekStart: "2026-10-27",
  weekEnd: "2026-11-02",
  status: "midevent",
  categories: [
    { statId: 17, label: "ST", higherIsBetter: true },
    { statId: 19, label: "TO", higherIsBetter: false },
  ],
  teams: [
    week({ teamId: "a", isMine: true, steals: "20", turnovers: "50" }),
    week({ teamId: "b", steals: "35", turnovers: "40" }),
    week({ teamId: "c", steals: "30", turnovers: "70" }),
    week({ teamId: "d", steals: "10", turnovers: "60" }),
  ],
  pairings: [
    { teamAId: "a", teamBId: "b" },
    { teamAId: "c", teamBId: "d" },
  ],
};

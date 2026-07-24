import { SeasonStatCard } from "court-vision";

const jokic = [
  { key: "pts", label: "PTS", value: "29.6", rank: 3, rankTone: "leader", eligibleCount: 178 },
  { key: "reb", label: "REB", value: "12.7", rank: 4, rankTone: "leader", eligibleCount: 178 },
  { key: "ast", label: "AST", value: "10.2", rank: 1, rankTone: "leader", eligibleCount: 178 },
  { key: "stl", label: "STL", value: "1.8", rank: 9, rankTone: "leader", eligibleCount: 178 },
  { key: "blk", label: "BLK", value: "0.6", rank: 61, rankTone: "leader", eligibleCount: 178 },
  { key: "fg", label: "FG%", value: "57.6%", rank: 11, rankTone: "leader", eligibleCount: 120 },
  { key: "tov", label: "TOV", value: "3.2", rank: 14, rankTone: "neutral", eligibleCount: 178 },
];

const rolePlayer = [
  { key: "pts", label: "PTS", value: "9.4", rank: 141, rankTone: "leader", eligibleCount: 178 },
  { key: "reb", label: "REB", value: "3.1", rank: 120, rankTone: "leader", eligibleCount: 178 },
  { key: "ast", label: "AST", value: "2.0", rank: 96, rankTone: "leader", eligibleCount: 178 },
  { key: "stl", label: "STL", value: "1.1", rank: 41, rankTone: "leader", eligibleCount: 178 },
  { key: "blk", label: "BLK", value: "0.3", rank: 118, rankTone: "leader", eligibleCount: 178 },
  { key: "fg", label: "FG%", value: "44.2%", rank: 88, rankTone: "leader", eligibleCount: 120 },
  { key: "tov", label: "TOV", value: "1.0", rank: 132, rankTone: "neutral", eligibleCount: 178 },
];

export const Leader = () => <SeasonStatCard season="2024-25" stats={jokic} title="Season Averages" />;

export const RolePlayer = () => <SeasonStatCard season="2024-25" stats={rolePlayer} title="Season Averages" />;

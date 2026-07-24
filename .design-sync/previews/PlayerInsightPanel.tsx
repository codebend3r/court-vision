import { PlayerInsightPanel } from "court-vision";

const player = {
  playerId: 203999,
  firstName: "Nikola",
  lastName: "Jokic",
  fullName: "Nikola Jokic",
  teamAbbr: "DEN",
  position: "C",
  nbaPersonId: 203999,
};

const insight = {
  playerId: 203999,
  gamesPlayed: 70,
  minutesPerGame: 34.6,
  z: 14.24,
  overallRank: 1,
  overallOf: 178,
  positionRank: 1,
  positionOf: 32,
  positionGroup: "C",
  categories: [
    { key: "pts", label: "PTS", perGame: 29.6, z: 1.9, kind: "counting" },
    { key: "reb", label: "REB", perGame: 12.7, z: 2.1, kind: "counting" },
    { key: "ast", label: "AST", perGame: 10.2, z: 3.4, kind: "counting" },
    { key: "stl", label: "STL", perGame: 1.8, z: 0.9, kind: "counting" },
    { key: "blk", label: "BLK", perGame: 0.6, z: -0.4, kind: "counting" },
    { key: "tpm", label: "3PM", perGame: 1.1, z: -0.5, kind: "counting" },
    { key: "fg", label: "FG%", perGame: 0.576, z: 1.7, kind: "ratio" },
    { key: "ft", label: "FT%", perGame: 0.81, z: 0.3, kind: "ratio" },
    { key: "tov", label: "TOV", perGame: 3.2, z: -0.8, kind: "counting" },
  ],
};

export const Populated = () => <PlayerInsightPanel player={player} insight={insight} />;

export const Empty = () => <PlayerInsightPanel player={null} insight={null} />;

import { FantasyValueTable } from "court-vision";

type Row = {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  teamAbbr: string;
  position: string;
  nbaPersonId: number;
  rank: number;
  values: { playerId: number; z: number; g: number; points: number; vorp: number; positional: number };
};

const make = (
  rank: number,
  playerId: number,
  nbaPersonId: number,
  firstName: string,
  lastName: string,
  teamAbbr: string,
  position: string,
  v: [number, number, number, number, number],
): Row => ({
  playerId,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  teamAbbr,
  position,
  nbaPersonId,
  rank,
  values: { playerId, z: v[0], g: v[1], points: v[2], vorp: v[3], positional: v[4] },
});

const rows: Row[] = [
  make(1, 203999, 203999, "Nikola", "Jokic", "DEN", "C", [14.24, 11.8, 54.2, 9.6, 12.1]),
  make(2, 1628983, 1628983, "Shai", "Gilgeous-Alexander", "OKC", "G", [12.9, 10.4, 51.7, 8.4, 10.9]),
  make(3, 1629029, 1629029, "Luka", "Doncic", "DAL", "G-F", [11.7, 9.2, 53.9, 7.8, 9.5]),
  make(4, 203507, 203507, "Giannis", "Antetokounmpo", "MIL", "F", [10.8, 8.1, 55.4, 7.1, 8.7]),
  make(5, 1641705, 1641705, "Victor", "Wembanyama", "SAS", "F-C", [10.1, 8.6, 45.8, 6.9, 9.9]),
  make(6, 1628369, 1628369, "Jayson", "Tatum", "BOS", "F", [9.3, 7.4, 48.1, 6.2, 7.6]),
];

export const Standings = () => (
  <FantasyValueTable rows={rows} sort="z" dir="desc" onSort={() => {}} />
);
